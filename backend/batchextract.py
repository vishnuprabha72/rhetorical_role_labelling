"""
Batch Indian Supreme Court Judgment Extractor  (CLI wrapper)
=============================================================
Processes a folder of PDF judgments. For each PDF, produces a JSON file with:
  - metadata   : court, case numbers, parties, judge/coram, reportable flag
  - paragraphs : number, label, text, rhetorical_role

Usage
-----
    uv run python batchextract.py --input /path/to/pdfs --output /path/to/json

All extraction logic lives in app/core/extractor.py.
"""

import json
import argparse
from collections import Counter
from pathlib import Path

from app.core.extractor import extract_judgment


def process_folder(input_dir, output_dir, verbose=True):
    input_path  = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(input_path.glob('*.pdf'))
    if not pdf_files:
        print(f"No PDF files found in {input_dir}")
        return

    results = {'processed': 0, 'failed': 0, 'files': []}

    for pdf_file in pdf_files:
        if verbose:
            print(f"  Processing: {pdf_file.name} ...", end=' ', flush=True)
        try:
            doc = extract_judgment(str(pdf_file))
            out_file = output_path / (pdf_file.stem + '.json')
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
            n = doc['stats']['total_paragraphs']
            results['processed'] += 1
            results['files'].append({
                'input': pdf_file.name,
                'output': out_file.name,
                'paragraphs': n,
                'roles': doc['stats']['role_distribution'],
            })
            if verbose:
                print(f"OK  ({n} paragraphs)")
        except Exception as e:
            results['failed'] += 1
            results['files'].append({'input': pdf_file.name, 'error': str(e)})
            if verbose:
                print(f"FAILED: {e}")

    manifest_path = output_path / '_manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    if verbose:
        print(f"\n{'─'*50}")
        print(f"Processed : {results['processed']} judgments")
        print(f"Failed    : {results['failed']} judgments")
        print(f"Output    : {output_path}/")
        print(f"Manifest  : {manifest_path.name}")

    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Batch-extract paragraphs from Indian SC judgment PDFs.'
    )
    parser.add_argument('--input',  '-i', required=True,
                        help='Folder containing PDF judgments')
    parser.add_argument('--output', '-o', required=True,
                        help='Folder to write JSON output files')
    parser.add_argument('--quiet',  '-q', action='store_true',
                        help='Suppress per-file progress output')
    args = parser.parse_args()
    process_folder(args.input, args.output, verbose=not args.quiet)
