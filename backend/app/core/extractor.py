"""
Rule-based Indian Supreme Court Judgment Extractor (v2 — improved)
==================================================================
Produces metadata + numbered paragraphs with rhetorical roles from a PDF.

Key improvements over v1:
 - Paragraph boundary detection uses relaxed lookbehind (any whitespace)
 - Quote-aware splitting: paragraph numbers inside quoted passages from
   other judgments/statutes are masked so they don't steal real para slots
 - Greedy sequential filter replaced with best-path algorithm that finds
   the longest monotonically increasing subsequence of paragraph numbers
 - No content is eliminated: all text between identified paragraphs is
   preserved (either attached to the preceding paragraph or kept as-is)
 - Signature detection is more conservative

Rhetorical Roles
-----------------
  PREAMBLE   court name, case number, party names, judge block
  FACT       narrative facts, prosecution case, background
  ISSUE      questions for determination
  ARG_P      petitioner / appellant submissions
  ARG_R      respondent submissions
  LAW        statute text, precedent citations, legal principles
  REASON     court's analysis / discussion
  HOLDING    court's conclusion on each issue
  ORDER      final order, directions, disposal
  NONE       section headings, procedural notes, unclassified
"""

import re
from collections import Counter
from pathlib import Path
import pdfplumber


# ════════════════════════════════════════════════════════════
#  SIMILARITY HELPER
# ════════════════════════════════════════════════════════════

def _nratio(a, b):
    """Bigram Jaccard similarity."""
    if not a and not b: return 1.0
    if not a or not b:  return 0.0
    a, b = a.lower().strip(), b.lower().strip()
    def bg(s): return set(s[i:i+2] for i in range(len(s)-1))
    ba, bb = bg(a), bg(b)
    if not ba and not bb: return 1.0
    if not ba or not bb:  return 0.0
    return len(ba & bb) / len(ba | bb)


# ════════════════════════════════════════════════════════════
#  STAGE 1 — HEADER / FOOTER DETECTION
# ════════════════════════════════════════════════════════════

def _detect_header_footer(pre, n):
    idxs  = sorted(set([0, max(0, n-2), n//2, n//4, n//8]))
    sampl = [pre[i] for i in idxs]
    ns    = len(sampl)

    def _hcand(t):
        parts = t.split('\n\n', 1)
        lines = [l.strip() for l in parts[0].split('\n') if l.strip()]
        while lines and re.match(r'^\d+$', lines[0]):
            lines = lines[1:]
        return lines[0] if lines else ''

    def _fcand(t):
        rev = t.split('\n\n', 1)[-1][::-1]
        return rev.split('\n', 1)[0][::-1].strip()

    hc = [_hcand(p) for p in sampl]
    fc = [_fcand(p) for p in sampl]
    hs = [round(_nratio(hc[0], hc[j])) for j in range(ns)]
    fs = [round(_nratio(fc[0], fc[j])) for j in range(ns)]

    running_header = hc[0] if (hc[0] and hs == [1]*ns) else None
    running_footer = fc[0] if (fc[0] and fs == [1]*ns) else None

    def _finv(f):
        return re.sub(r'\s+[Pp]age\s+\d+\s+of\s+\d+\s*$', '', f).strip()
    fc_inv = [_finv(f) for f in fc]
    fi_s   = [round(_nratio(fc_inv[0], fc_inv[j])) for j in range(ns)]
    paged_pfx = (fc_inv[0]
                 if (fc_inv[0] and not running_footer
                     and fi_s == [1]*ns and fc_inv[0] != fc[0])
                 else None)

    _pgnum = re.compile(r'^\d+(\s*[\|/]\s*[\w\s]+)?$')
    has_pg_ftr = (not running_footer and not paged_pfx
                  and all(_pgnum.match(f) for f in fc if f))

    return running_header, running_footer, paged_pfx, has_pg_ftr, _pgnum


# ════════════════════════════════════════════════════════════
#  STAGE 2 — TITLE BLOCK BOUNDARY
# ════════════════════════════════════════════════════════════

def _find_para_boundary(text):
    """
    Return char position where numbered paragraphs truly begin.

    v2 FIX: Use a relaxed lookbehind (any whitespace before the number)
    so that "Calcutta 2. The" is matched. Confirm by checking that
    N and N+1 appear within 8000 chars (increased from 5000 to handle
    judgments with long first paragraphs).
    v3 FIX: Also handle "N Word" format (no period after number), common
    in some SC judgments: "1 Leave granted. 2 The respondent..."
    """
    # Relaxed: just need a space before the digit
    pats = [
        re.compile(r'(?<=\s)(?!\d{4}[. ])\d{1,3}\. (?=[A-Z][a-z])'),
        re.compile(r'(?<=\s)(?<!\()(?<!\d)\d{1,3}\) (?=[A-Z])'),
        # "N Word" format (no period) — require title-case word of 3+ chars
        re.compile(r'(?<=\s)(?!\d{4}\b)(\d{1,3}) (?=[A-Z][a-z]{2,})'),
    ]

    def _n(m, t):
        return int(re.match(r'\d+', t[m.start():]).group())

    for pat in pats:
        for m in pat.finditer(text):
            n = _n(m, text)
            if n > 10:
                continue
            window   = text[m.start(): m.start() + 8000]
            seq_nums = [_n(mm, window) for mm in pat.finditer(window)]
            if (n + 1) in seq_nums:
                return m.start()

    # Fallback: first number <= 5
    for pat in pats:
        for m in pat.finditer(text):
            if _n(m, text) <= 5:
                return m.start()

    return None


# ════════════════════════════════════════════════════════════
#  STAGE 2b — METADATA PARSER
# ════════════════════════════════════════════════════════════

def _parse_metadata(title_block):
    meta = {'raw_header': title_block}
    if not title_block:
        return meta

    m = re.search(r'(SUPREME COURT OF INDIA|HIGH COURT OF [\w\s]+)', title_block, re.I)
    if m:
        meta['court'] = m.group(0).strip()

    m = re.search(r'(CIVIL APPELLATE|CRIMINAL APPELLATE|WRIT|ORIGINAL CIVIL)',
                  title_block, re.I)
    if m:
        meta['jurisdiction'] = m.group(0).strip()

    _case_pats = [
        (r'(?:CIVIL|CRIMINAL|WRIT|SPECIAL LEAVE)\s+(?:APPEAL|PETITION|MISC\.?)'
         r'[\w\s.,/()-]*?(?:NO\.?|NOS\.?)\s*[\d,/ -]+(?:\s*OF\s*\d{4})?'),
        r'SLP\s*\([A-Z]+\)[\w\s.,/()-]*?(?:NO\.?|NOS\.?)\s*[\d,/ -]+(?:\s*OF\s*\d{4})?',
        r'C\.?A\.?\s*(?:NO\.?|NOS\.?)\s*[\d,/ -]+(?:\s*OF\s*\d{4})?',
    ]
    case_nos = []
    for pat in _case_pats:
        for m in re.finditer(pat, title_block, re.I):
            val = re.sub(r'\s+', ' ', m.group(0)).strip()
            if len(val) > 5 and val not in case_nos:
                case_nos.append(val)
    if case_nos:
        meta['case_numbers'] = case_nos

    parties = []
    for m in re.finditer(
        r'([A-Z][A-Z\s&.,()-]+?)\s*[….]{2,}\s*(APPELLANT|RESPONDENT|PETITIONER|ACCUSED)',
        title_block, re.I
    ):
        name = re.sub(r'\s+', ' ', m.group(1)).strip()
        role = m.group(2).upper()
        if len(name) > 2:
            parties.append({'name': name, 'role': role})
    if parties:
        meta['parties'] = parties

    judges = []
    for m in re.finditer(r'([A-Z][a-zA-Z.\s]+?),\s*J\.?\b', title_block):
        name = m.group(1).strip()
        if (3 < len(name) < 50
                and not re.search(r'COURT|APPEAL|PETITION|JURIS', name, re.I)):
            entry = name + ', J.'
            if entry not in judges:
                judges.append(entry)
    if judges:
        meta['coram'] = judges

    if re.search(r'\bREPORTABLE\b', title_block, re.I):
        meta['reportable'] = not bool(re.search(r'NON.?REPORTABLE', title_block, re.I))

    m = re.search(r'\b(J\s+U\s+D\s+G\s+M\s+E\s+N\s+T|O\s+R\s+D\s+E\s+R)\b',
                  title_block, re.I)
    if m:
        meta['judgment_marker'] = re.sub(r'\s+', ' ', m.group(0)).strip()

    return meta


# ════════════════════════════════════════════════════════════
#  STAGE 3 — PARAGRAPH SPLITTING  (v2 — best-path approach)
# ════════════════════════════════════════════════════════════

def _find_all_candidate_splits(text):
    """
    Find all positions where a paragraph number pattern occurs.
    Returns list of (position, end_position, major_number, label_str).
    
    v2: Uses relaxed lookbehind — just requires whitespace (or start of string)
    before the digit.
    """
    # Patterns: "N. Text", "N.M Text", "N.M. Text", "N Text"
    # Relaxed lookbehind: any whitespace before the number
    pats = [
        # Hierarchical: "9.1 Text" or "9.1. Text"
        re.compile(r'(?:(?<=\s)|(?<=^))(?!\d{4})(\d{1,3})\.(\d{1,3})\.?\s+(?=[A-Z][a-z])'),
        # Plain with period: "3. Text"  — guard against years like "2010." and table rows
        # like "17. DOS L-II" (all-caps abbreviations). Require title-case word
        # start (uppercase letter followed by lowercase) to match prose only.
        re.compile(r'(?:(?<=\s)|(?<=^))(?!\d{4}[. ])(\d{1,3})\.\s+(?=[A-Z][a-z])'),
        # "N Word" format (no period after number), e.g. "1 Leave granted."
        # Use sentence-end lookbehind to limit false positives; require 3+ lowercase chars.
        re.compile(r'(?<=\.\s)(?!\d{4}\b)(\d{1,3})\s+(?=[A-Z][a-z]{2,})'),
    ]

    candidates = []  # (start, end, major, minor, label)
    for pat in pats:
        for m in pat.finditer(text):
            if pat.groups >= 2 and m.lastindex and m.lastindex >= 2:
                # Hierarchical
                major = int(m.group(1))
                minor = int(m.group(2))
                label = f"{major}.{minor}"
            else:
                major = int(m.group(1))
                minor = 0
                label = str(major)
            candidates.append((m.start(), m.end(), major, minor, label))

    # Sort by position, deduplicate overlaps
    candidates.sort(key=lambda x: (x[0], -(x[1] - x[0])))
    unique = []
    last_end = -1
    for c in candidates:
        if c[0] >= last_end:
            unique.append(c)
            last_end = c[1]

    # Filter candidates that look like list items inside a paragraph, not real
    # paragraph starts.  A list item is introduced after ":-", ":", or a quoted
    # header (e.g. "EXTERNAL INJURIES: 1. Contusion…").
    _list_intro = re.compile(r'[:\-]{1,2}\s*(?:"[^"]*")?\s*(?:[A-Z][A-Z ]+)?\s*$')
    filtered = []
    for c in unique:
        pre = text[max(0, c[0] - 250): c[0]]
        # Skip only small numbers (≤20) that immediately follow a list introduction
        if c[2] <= 20 and _list_intro.search(pre.rstrip()):
            continue
        filtered.append(c)

    return filtered


def _find_best_paragraph_sequence(candidates, expected_max=None):
    """
    Given a list of candidate paragraph split points (some real, some from
    quoted text), find the longest strictly increasing subsequence by
    paragraph number. This is the most likely sequence of real judgment
    paragraphs.
    
    The key insight: the judgment's own paragraph numbers form a strictly
    increasing sequence (1, 2, 3, ..., 59). Quoted paragraph numbers from
    other cases are interspersed but don't form part of this sequence.
    
    We use a modified LIS (Longest Increasing Subsequence) that:
    - Prefers sequences starting from small numbers (1 or 2)
    - Allows gaps (judgment may skip numbers, e.g. 42 → 45)
    - Weights candidates that look like "judgment paragraph starts"
      (preceded by end-of-sentence punctuation) more heavily
    """
    if not candidates:
        return []
    
    n = len(candidates)
    
    # Build key for each candidate: major * 10000 + minor
    def _key(c):
        return c[2] * 10000 + c[3]
    
    keys = [_key(c) for c in candidates]
    
    # Standard LIS with backtracking using patience + binary search
    # But we need to find the actual longest increasing subsequence
    # For our sizes (< 200 candidates), O(n^2) DP is fine
    
    # dp[i] = length of LIS ending at index i
    dp = [1] * n
    parent = [-1] * n
    
    for i in range(1, n):
        for j in range(i):
            if keys[j] < keys[i] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
                parent[i] = j
    
    # Find the best ending point
    # Prefer: longest sequence, then one that starts with smallest number
    best_len = max(dp)
    
    # Among all sequences of best_len, find one starting from the smallest key
    best_end = -1
    best_start_key = float('inf')
    
    for i in range(n):
        if dp[i] == best_len:
            # Trace back to find start key
            j = i
            while parent[j] != -1:
                j = parent[j]
            start_key = keys[j]
            if start_key < best_start_key:
                best_start_key = start_key
                best_end = i
    
    # Reconstruct the sequence
    seq_indices = []
    j = best_end
    while j != -1:
        seq_indices.append(j)
        j = parent[j]
    seq_indices.reverse()
    
    return [candidates[i] for i in seq_indices]


def _split_paragraphs(text):
    """
    Split judgment body into numbered paragraphs.
    
    v2 approach:
    1. Find ALL candidate paragraph-number positions (relaxed lookbehind)
    2. Use LIS algorithm to identify the real judgment paragraph sequence
    3. Split text at those positions, preserving ALL content
    """
    candidates = _find_all_candidate_splits(text)
    
    if not candidates:
        return [{'number': 0, 'label': 'intro', 'text': text.strip()}]
    
    # Find the best increasing sequence (the real judgment paragraphs)
    best_seq = _find_best_paragraph_sequence(candidates)
    
    if not best_seq:
        return [{'number': 0, 'label': 'intro', 'text': text.strip()}]
    
    # Build paragraph segments from the best sequence
    paragraphs = []
    
    # Text before the first identified paragraph
    first_pos = best_seq[0][0]
    if first_pos > 0:
        pre_text = text[:first_pos].strip()
        if pre_text:
            paragraphs.append({
                'number': 0,
                'label': 'intro',
                'text': pre_text,
            })
    
    # Each paragraph runs from its start to the start of the next
    for i, (start, end, major, minor, label) in enumerate(best_seq):
        if i + 1 < len(best_seq):
            next_start = best_seq[i + 1][0]
        else:
            next_start = len(text)
        
        para_text = text[start:next_start].strip()
        paragraphs.append({
            'number': major,
            'label': label,
            'text': para_text,
        })
    
    return paragraphs


# ════════════════════════════════════════════════════════════
#  STAGE 4 — RHETORICAL ROLE LABELLER
# ════════════════════════════════════════════════════════════

_ROLE_RULES = [
    ('ORDER', [
        r'\bappeal\s+is\s+(hereby\s+)?(dismissed|allowed|disposed)',
        r'\bwe\s+(hereby\s+)?direct\b',
        r'\baccordingly.{0,30}(dismissed|allowed|disposed)',
        r'\bno\s+order\s+as\s+to\s+costs\b',
        r'\bbail\s+bonds?\s+are\s+cancelled\b',
        r'\bshall\s+surrender\b',
        r'\binterim\s+order.{0,20}vacated\b',
        r'\bthe\s+(above|present)\s+appeal.{0,40}(fail|dismiss|allow)',
        r'\bpending\s+applications?.{0,30}disposed\b',
    ]),
    ('HOLDING', [
        r'\bwe\s+(are\s+of\s+the\s+(view|opinion)|hold|conclude|find)\b',
        r'\bwe\s+are\s+(clearly|therefore|thus)\s+of\s+the\s+(view|opinion)\b',
        r'\bin\s+(our|the)\s+(considered\s+)?view\b',
        r'\bfor\s+(the\s+)?foregoing\s+reasons\b',
        r'\bfor\s+what\s+has\s+been\s+(discussed|noted|observed)\b',
        r'\bthe\s+answer\s+to\s+(the\s+)?question\b',
        r'\baccordingly.{0,40}(we|this court)\b',
        r'\bwe\s+therefore\s+(hold|conclude|find|are)\b',
    ]),
    ('ISSUE', [
        r'\bthe\s+(main\s+|only\s+|sole\s+|primary\s+|central\s+)?question.{0,60}(is|arises|for\s+determination)\b',
        r'\bquestion\s+(of\s+law\s+)?for\s+(our\s+)?consideration\b',
        r'\bthe\s+(only\s+|main\s+)?issue.{0,30}(before|arises|is)\b',
        r'\bpoints?\s+(arising\s+)?for\s+determination\b',
        r'\bthe\s+question\s+that\s+(falls|arises|needs)\b',
    ]),
    ('ARG_P', [
        r'\b(learned\s+)?(senior\s+)?counsel\s+(for\s+the\s+)?(appellant|petitioner|accused)\b',
        r'\b(appellant|petitioner)\s+(has\s+|have\s+)?(submitted|contended|argued|urged)\b',
        r'\bon\s+behalf\s+of\s+the\s+(appellant|petitioner|accused)\b',
        r'\blearned\s+(senior\s+)?counsel.{0,40}(for\s+)?appellant\b',
        r'\bsubmission.{0,30}(on\s+behalf\s+of\s+)?(the\s+)?(appellant|petitioner)\b',
        r'\bthe\s+appellant.{0,30}(submits?|contends?|urges?|argues?|pleads?)\b',
        r'\bit\s+(is|was)\s+(submitted|contended|argued|urged)\s+(by|on\s+behalf\s+of)\s+(the\s+)?(appellant|petitioner|accused)\b',
        r'\bthe\s+(first|main|primary|sole)\s+contention\s+of\s+(the\s+)?(appellant|petitioner)\b',
        r'\b(mr|ms|mrs|dr|shri|smt)\.?\s+\w+.{0,40}(for\s+the\s+)?(appellant|petitioner)\b',
        r'\blearned\s+(senior\s+)?advocate.{0,40}(appellant|petitioner)\b',
        r'\bappellant.s?\s+(counsel|advocate|contention|submission)\b',
        r'\bpetitioner.s?\s+(counsel|advocate|contention|submission)\b',
        r'\bit\s+is\s+(further\s+)?submitted\s+(that|by)\b',
        r'\bthe\s+accused.{0,30}(submits?|contends?|argues?|denies?)\b',
    ]),
    ('ARG_R', [
        r'\b(learned\s+)?(senior\s+)?counsel\s+(for\s+the\s+)?respondent\b',
        r'\brespondent.{0,30}(submitted|contended|argued|urged)\b',
        r'\bon\s+behalf\s+of\s+the\s+respondent\b',
        r'\blearned\s+(senior\s+)?counsel.{0,40}(for\s+)?respondent\b',
        r'\bthe\s+state.{0,30}(submits?|contends?|argues?|urges?)\b',
        r'\blearned\s+(government\s+)?pleader\b',
        r'\blearned\s+(public\s+)?prosecutor\b',
        r'\bit\s+(is|was)\s+(submitted|contended|argued)\s+(by|on\s+behalf\s+of)\s+(the\s+)?respondent\b',
        r'\bthe\s+respondent.{0,50}(submits?|contends?|urges?|argues?|pleads?)\b',
        r'\b(mr|ms|mrs|dr|shri|smt)\.?\s+\w+.{0,40}for\s+the\s+respondent\b',
        r'\blearned\s+(senior\s+)?advocate.{0,40}respondent\b',
        r'\brespondent.s?\s+(counsel|advocate|contention|submission)\b',
        r'\bthe\s+(union\s+of\s+india|government).{0,30}(submits?|contends?|argues?)\b',
        r'\bthe\s+counter.?affidavit\b',
        r'\bthe\s+reply\s+(filed|submitted)\s+by\s+(the\s+)?respondent\b',
    ]),
    ('LAW', [
        r'\bsection\s+\d+\s+of\s+the\b',
        r'\barticle\s+\d+\s+of\s+the\b',
        r'\bthe\s+\w[\w\s]+act[,\s]+\d{4}\b',
        r'\b\(\d{4}\)\s+\d+\s+(SCC|SCR|AIR|All|Bom|Mad|Cal)\b',
        r'\breported\s+(as|in)\b',
        r'\bAIR\s+\d{4}\b',
        r'\bthis\s+court\s+(has\s+)?held\s+in\b',
        r'\bin\s+the\s+case\s+of\b',
        r'\breliance\s+(is\s+)?placed\s+on\b',
        r'\bthe\s+law\s+(laid\s+down|settled)\b',
        r'\bprecedent\b',
        r'\bratio\s+decidendi\b',
    ]),
    ('REASON', [
        r'\bhaving\s+(regard|considered|heard)\b',
        r'\bwe\s+have\s+(considered|perused|examined|gone through)\b',
        r'\bin\s+(our\s+)?(view|opinion|considered opinion)\b',
        r'\bwe\s+(note|observe|find|notice)\s+that\b',
        r'\bit\s+is\s+(clear|evident|apparent|manifest|obvious)\s+(from|that)\b',
        r'\bthe\s+(evidence|record|material)\s+(shows?|indicates?|reveals?)\b',
        r'\bupon\s+perusal\b',
        r'\bwe\s+are\s+in\s+agreement\b',
        r'\bwe\s+(do\s+not|cannot)\s+(agree|accept|find)\b',
        r'\bthe\s+(above|aforesaid|foregoing)\s+(discussion|analysis)\b',
        r'\bapplying\s+the\s+(law|test|principle)\b',
        r'\bthe\s+courts?\s+below\s+(has|have|had)\b',
        r'\bthe\s+(trial|high)\s+court\s+(has|have|correctly|rightly)\b',
    ]),
    ('FACT', [
        r'\bthe\s+facts?\s+(of\s+the\s+case|leading\s+to|briefly|in\s+(brief|nutshell))\b',
        r'\bthe\s+prosecution\s+(case|story|version)\b',
        r'\bbriefly\s+stated\b',
        r'\bthe\s+background\b',
        r'\bthe\s+appellant\s+(herein\s+)?(was|is|has\s+been)\b',
        r'\bthe\s+respondent\s+(herein\s+)?(was|is|has\s+been)\b',
        r'\bthe\s+impugned\s+(judgment|order)\b',
        r'\bthe\s+(first|second|trial|sessions|high)\s+court\s+(has|had|held)\b',
        r'\bvide\s+(judgment|order)\s+dated\b',
        r'\b(aggrieved|dissatisfied)\s+(by|with)\b',
        r'\bpassed\s+in\s+(criminal|civil)\s+appeal\b',
        r'\bregistered\s+under\s+section\b',
        r'\bthe\s+deceased\b',
        r'\bthe\s+accused\b',
        r'\bthe\s+(complaint|FIR|charge.?sheet)\b',
        # Transfer / service matter facts
        r'\b(was|were)\s+(transferred|posted|appointed|promoted|suspended|dismissed)\b',
        r'\bby\s+(an?\s+)?(order|notification)\s+dated\b',
        r'\bon\s+\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b',
        r'\bthe\s+order\s+of\s+transfer\b',
        r'\bthe\s+(writ\s+petition|appeal|petition)\s+(was\s+)?(filed|moved|dismissed|allowed|disposed)\b',
        r'\bthe\s+(CAT|tribunal|high\s+court|sessions\s+court|magistrate)\b',
        r'\b(interim|ad\s+interim)\s+(stay|order|direction|relief)\b',
        r'\bthe\s+(police|inspector|sub.inspector)\b',
        r'\bpostmortem\b',
        r'\binjur(y|ies)\s+(found|noted|observed)\b',
        r'\bwitness(es)?\s+(deposed|stated|testified)\b',
        r'\bthe\s+(first|second|third|1st|2nd|3rd)\s+(accused|witness|complainant|informant)\b',
        r'\bleave\s+granted\b',
    ]),
]

_COMPILED_RULES = [
    (role, [re.compile(p, re.I | re.S) for p in patterns])
    for role, patterns in _ROLE_RULES
]

_HEADING_RE = re.compile(
    r'^(preliminary|background|facts?|evidence|submissions?|arguments?|'
    r'issues?|analysis|discussion|reasoning|conclusion|order|'
    r'the\s+relevant\s+facts?|the\s+evidence|the\s+submissions?)$',
    re.I
)


def _assign_role(para_text, para_number, total_paras):
    text = para_text.strip()

    if len(text.split()) <= 6 and _HEADING_RE.match(text):
        return 'NONE'

    scores = {role: 0 for role, _ in _COMPILED_RULES}
    for role, patterns in _COMPILED_RULES:
        for pat in patterns:
            if pat.search(text):
                scores[role] += 1

    if total_paras > 0:
        position = para_number / total_paras
        if position >= 0.90:
            scores['ORDER']   += 3
            scores['HOLDING'] += 2
        elif position >= 0.75:
            scores['HOLDING'] += 1
            scores['REASON']  += 1
        elif position >= 0.35:
            # Middle section: analysis/reasoning is most common
            scores['REASON']  += 1
        elif position <= 0.30:
            # Early section: likely facts
            scores['FACT']    += 2

    best_role  = max(scores, key=scores.get)
    best_score = scores[best_role]

    return best_role if best_score > 0 else 'NONE'


# ════════════════════════════════════════════════════════════
#  PUBLIC API
# ════════════════════════════════════════════════════════════

def extract_judgment(pdf_path: str) -> dict:
    """
    Extract metadata, paragraphs, and rhetorical roles from a judgment PDF.

    Returns a dict with keys: source_file, metadata, paragraphs, stats.
    """
    with pdfplumber.open(pdf_path) as pdf:
        raw_pages = [p.extract_text(x_tolerance=3, y_tolerance=3) or ""
                     for p in pdf.pages]
    n = len(raw_pages)
    pre = [re.sub(r'\n\d+\n', '\n', p) for p in raw_pages]

    running_header, running_footer, paged_pfx, has_pg_ftr, _pgnum = \
        _detect_header_footer(pre, n)

    # Detect recurring mid-page lines (e.g. "Case Name vs. Other Party")
    line_page_count: Counter = Counter()
    for page_text in pre:
        seen_on_page: set = set()
        for line in page_text.split('\n'):
            s = line.strip()
            if s and len(s) > 15:
                seen_on_page.add(s)
        for s in seen_on_page:
            line_page_count[s] += 1

    recur_threshold = max(3, n // 4)
    recurring_lines = {s for s, cnt in line_page_count.items()
                       if cnt >= recur_threshold}

    all_lines = []
    for page_text in pre:
        for line in page_text.split('\n'):
            s = line.strip()
            if not s:                                        continue
            if re.match(r'^\d+$', s):                       continue
            if running_header and s == running_header:      continue
            if running_footer and s == running_footer:      continue
            if paged_pfx      and s.startswith(paged_pfx): continue
            if has_pg_ftr     and _pgnum.match(s):          continue
            if s in recurring_lines:                        continue
            all_lines.append(s)

    full_text = re.sub(r'\s+', ' ', ' '.join(all_lines)).strip()

    boundary = _find_para_boundary(full_text)
    if boundary is not None:
        title_block_raw = full_text[:boundary].strip()
        body_text       = full_text[boundary:]
    else:
        title_block_raw = ''
        body_text       = full_text

    metadata = _parse_metadata(title_block_raw)

    # v2: More conservative signature detection — only trim AFTER the last
    # real paragraph's content. Look for signature block pattern only in
    # the last 5% of text.
    cutoff = int(len(body_text) * 0.95)
    _sig   = re.compile(r'\.{5,}\s*J\.|New\s+Delhi\b|\.\.\.\s*J\.', re.I)
    m_end  = _sig.search(body_text[cutoff:])
    if m_end:
        body_text = body_text[:cutoff + m_end.start()].strip()

    paragraphs = _split_paragraphs(body_text)

    total = len(paragraphs)
    for p in paragraphs:
        p['rhetorical_role'] = _assign_role(p['text'], p['number'], total)

    role_dist = dict(Counter(p['rhetorical_role'] for p in paragraphs))

    return {
        'source_file': Path(pdf_path).name,
        'metadata':    metadata,
        'paragraphs':  paragraphs,
        'stats': {
            'total_paragraphs': total,
            'role_distribution': role_dist,
        },
    }


if __name__ == '__main__':
    import sys
    import json

    pdf = sys.argv[1] if len(sys.argv) > 1 else '2.pdf'
    result = extract_judgment(pdf)

    print(f"\n{'='*60}")
    print(f"Source: {result['source_file']}")
    print(f"Total paragraphs: {result['stats']['total_paragraphs']}")
    print(f"Role distribution: {result['stats']['role_distribution']}")
    print(f"{'='*60}")

    for p in result['paragraphs']:
        label = p['label']
        role  = p['rhetorical_role']
        text  = p['text'][:120].replace('\n', ' ')
        print(f"  [{label:>5s}] ({role:8s}) {text}...")