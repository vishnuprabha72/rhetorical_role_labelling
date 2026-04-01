import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Select, MenuItem, FormControl,
  Button, Chip, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
  TextField, IconButton, Stack, Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CommentIcon from "@mui/icons-material/Comment";
import CommentOutlinedIcon from "@mui/icons-material/CommentOutlined";
import { getResult, saveCorrections, downloadSingle } from "../client";
import RoleChip from "../components/RoleChip";

const ROLES = ["NONE", "FACT", "ISSUE", "ARG_P", "ARG_R", "LAW", "REASON", "HOLDING", "ORDER"];

const ROLE_COLORS = {
  FACT:    "#EFF6FF", ISSUE:   "#FFF1F2", ARG_P:   "#FAF5FF",
  ARG_R:   "#F5F3FF", LAW:     "#F0FDF4", REASON:  "#FFFBEB",
  HOLDING: "#FFF7ED", ORDER:   "#ECFDF5", NONE:    "#F8FAFC",
};

const ROLE_BORDER = {
  FACT:    "#BFDBFE", ISSUE:   "#FECDD3", ARG_P:   "#E9D5FF",
  ARG_R:   "#DDD6FE", LAW:     "#BBF7D0", REASON:  "#FDE68A",
  HOLDING: "#FED7AA", ORDER:   "#A7F3D0", NONE:    "#E2E8F0",
};

export default function AnnotationPage() {
  const { fileId } = useParams();
  const navigate   = useNavigate();
  const [result, setResult]         = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [originalRoles, setOriginalRoles] = useState({});
  const [commentOpen, setCommentOpen]     = useState({});
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    getResult(fileId)
      .then(({ data }) => {
        setResult(data);
        setParagraphs(data.paragraphs.map((p) => ({ ...p, comment: p.comment ?? "" })));
        const orig = {};
        data.paragraphs.forEach((p) => { orig[p.number] = p.rhetorical_role; });
        setOriginalRoles(orig);
        const open = {};
        data.paragraphs.forEach((p, i) => { if (p.comment && !p.old) open[i] = true; });
        setCommentOpen(open);
      })
      .catch(() => setError("Could not load judgment. Upload it first."));
  }, [fileId]);

  const handleRoleChange = (idx, newRole) => {
    setParagraphs((prev) => { const c = [...prev]; c[idx] = { ...c[idx], rhetorical_role: newRole }; return c; });
    setDirty(true); setSaved(false);
  };

  const handleCommentChange = (idx, text) => {
    setParagraphs((prev) => { const c = [...prev]; c[idx] = { ...c[idx], comment: text }; return c; });
    setDirty(true); setSaved(false);
  };

  const toggleComment = (idx) =>
    setCommentOpen((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const missingComments = paragraphs.reduce((acc, p, idx) => {
    const changed = originalRoles[p.number] !== undefined && p.rhetorical_role !== originalRoles[p.number];
    if (changed && !p.comment.trim()) acc.add(idx);
    return acc;
  }, new Set());

  const handleSave = async () => {
    if (missingComments.size > 0) {
      setError(`Please add a comment for the ${missingComments.size} paragraph(s) whose role was changed.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      await saveCorrections(fileId, paragraphs.map((p) => ({
        number: p.number,
        rhetorical_role: p.rhetorical_role,
        comment: p.comment || null,
      })));
      const orig = {};
      paragraphs.forEach((p) => { orig[p.number] = p.rhetorical_role; });
      setOriginalRoles(orig);
      setDirty(false); setSaved(true);
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const { data } = await downloadSingle(fileId);
    const url = URL.createObjectURL(data);
    Object.assign(document.createElement("a"), { href: url, download: `${fileId}.json` }).click();
    URL.revokeObjectURL(url);
  };

  if (!result && !error) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 12 }}><CircularProgress size={36} /></Box>;
  }

  if (error && !result) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 8, px: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")}>Back to Upload</Button>
      </Box>
    );
  }

  const dist = paragraphs.reduce((acc, p) => {
    acc[p.rhetorical_role] = (acc[p.rhetorical_role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Box sx={{ maxWidth: 1060, mx: "auto", mt: 4, px: { xs: 2, sm: 3 }, pb: 10 }}>

      {/* ── Header card ── */}
      <Paper elevation={1} sx={{ px: 3, py: 2.5, mb: 3, borderRadius: "14px" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              size="small"
              onClick={() => navigate("/results")}
              sx={{ mb: 1, color: "#64748B", pl: 0 }}
            >
              All Results
            </Button>
            <Typography variant="h5" noWrap>{result.source_file}</Typography>
            {result.metadata.parties?.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {result.metadata.parties.map((p) => p.name).join(" v. ")}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 1, flexShrink: 0 }}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload} size="small">
              Download
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!dirty || saving}
              size="small"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </Box>

        {/* Role distribution bar */}
        <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #F1F5F9" }}>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1.25, display: "block" }}>
            Role Distribution
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {ROLES.filter((r) => dist[r] > 0).map((r) => (
              <Chip
                key={r}
                label={`${r} · ${dist[r]}`}
                size="small"
                sx={{
                  bgcolor: ROLE_COLORS[r],
                  border: `1px solid ${ROLE_BORDER[r]}`,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Paper>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Corrections saved successfully.</Alert>}
      {error && result && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Metadata ── */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>Case Metadata</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 1, columnGap: 2 }}>
            {[
              ["Court",        result.metadata.court],
              ["Jurisdiction", result.metadata.jurisdiction],
              ["Case No.",     result.metadata.case_numbers?.join(", ")],
              ["Coram",        result.metadata.coram?.join(", ")],
              ["Reportable",   result.metadata.reportable != null ? (result.metadata.reportable ? "Yes" : "No") : null],
            ]
              .filter(([, v]) => v)
              .map(([label, val]) => (
                <>
                  <Typography key={label + "k"} variant="caption" fontWeight={600} color="text.secondary" sx={{ pt: 0.1 }}>
                    {label}
                  </Typography>
                  <Typography key={label + "v"} variant="caption">{val}</Typography>
                </>
              ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ── Paragraph cards ── */}
      {paragraphs.map((para, idx) => {
        const origRole    = originalRoles[para.number];
        const roleChanged = origRole !== undefined && para.rhetorical_role !== origRole;
        const needsComment = missingComments.has(idx);
        const hasComment   = Boolean(para.comment);
        const hasPersistentAnnotation = !roleChanged && Boolean(para.old) && para.old !== para.rhetorical_role;
        const showOptional = !roleChanged && !hasPersistentAnnotation && Boolean(commentOpen[idx]);

        return (
          <Paper
            key={para.number}
            elevation={0}
            sx={{
              mb: 1.5,
              borderRadius: "12px",
              border: "1px solid",
              borderColor: needsComment ? "#FECACA" : ROLE_BORDER[para.rhetorical_role] ?? "#E2E8F0",
              borderLeft: "4px solid",
              borderLeftColor: needsComment ? "#DC2626" : ROLE_BORDER[para.rhetorical_role] ?? "#E2E8F0",
              bgcolor: ROLE_COLORS[para.rhetorical_role] ?? "#F8FAFC",
              transition: "border-color 0.15s, background-color 0.15s",
            }}
          >
            <Box sx={{ display: "flex", gap: 2, p: 2 }}>

              {/* Para number badge */}
              <Box
                sx={{
                  minWidth: 32, height: 24,
                  borderRadius: "6px",
                  bgcolor: "#E2E8F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, mt: 0.3,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {para.label || para.number}
                </Typography>
              </Box>

              {/* Para text */}
              <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.75, color: "#1E293B" }}>
                {para.text}
              </Typography>

              {/* ── Right panel ── */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, width: 230, flexShrink: 0 }}>

                {/* Role dropdown */}
                <FormControl size="small" fullWidth>
                  <Select
                    value={para.rhetorical_role}
                    onChange={(e) => handleRoleChange(idx, e.target.value)}
                    sx={{ fontSize: "0.8125rem", bgcolor: "background.paper" }}
                  >
                    {ROLES.map((r) => (
                      <MenuItem key={r} value={r} sx={{ py: 0.75 }}>
                        <RoleChip role={r} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Role changed: indicator + required comment */}
                {roleChanged && (
                  <>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Chip
                        label={origRole}
                        size="small"
                        sx={{
                          bgcolor: ROLE_COLORS[origRole] ?? "#F8FAFC",
                          border: `1px solid ${ROLE_BORDER[origRole] ?? "#E2E8F0"}`,
                          textDecoration: "line-through",
                          opacity: 0.75,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          "& .MuiChip-label": { px: "8px" },
                        }}
                      />
                      <ArrowForwardIcon sx={{ fontSize: 13, color: "#94A3B8", flexShrink: 0 }} />
                      <RoleChip role={para.rhetorical_role} />
                    </Box>

                    <TextField
                      fullWidth multiline minRows={2} maxRows={5} size="small"
                      placeholder="Reason for change (required)…"
                      value={para.comment}
                      onChange={(e) => handleCommentChange(idx, e.target.value)}
                      error={needsComment}
                      helperText={needsComment ? "Required when changing role." : ""}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.8rem",
                          bgcolor: "#fff",
                          ...(needsComment && { borderColor: "#DC2626" }),
                        },
                      }}
                    />
                  </>
                )}

                {/* Persisted annotation from a previous save */}
                {hasPersistentAnnotation && (
                  <>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Chip
                        label={para.old}
                        size="small"
                        sx={{
                          bgcolor: ROLE_COLORS[para.old] ?? "#F8FAFC",
                          border: `1px solid ${ROLE_BORDER[para.old] ?? "#E2E8F0"}`,
                          textDecoration: "line-through",
                          opacity: 0.75,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          "& .MuiChip-label": { px: "8px" },
                        }}
                      />
                      <ArrowForwardIcon sx={{ fontSize: 13, color: "#94A3B8", flexShrink: 0 }} />
                      <RoleChip role={para.rhetorical_role} />
                    </Box>
                    <Box>
                      <Tooltip title={hasComment ? "Edit comment" : "Add comment"}>
                        <Button
                          size="small"
                          startIcon={hasComment ? <CommentIcon sx={{ fontSize: "15px !important" }} /> : <CommentOutlinedIcon sx={{ fontSize: "15px !important" }} />}
                          onClick={() => toggleComment(idx)}
                          sx={{
                            color: hasComment ? "primary.main" : "#94A3B8",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            px: 1,
                            py: 0.4,
                            bgcolor: hasComment ? "primary.light" : "transparent",
                            "&:hover": { bgcolor: "primary.light", color: "primary.main" },
                          }}
                        >
                          {hasComment ? "Comment" : "Add note"}
                        </Button>
                      </Tooltip>
                      {commentOpen[idx] && (
                        <TextField
                          fullWidth multiline minRows={2} maxRows={5} size="small"
                          placeholder="Add a note…"
                          value={para.comment}
                          onChange={(e) => handleCommentChange(idx, e.target.value)}
                          sx={{ mt: 1, "& .MuiOutlinedInput-root": { fontSize: "0.8rem", bgcolor: "#fff" } }}
                        />
                      )}
                      {hasComment && !commentOpen[idx] && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5, px: 0.5, lineHeight: 1.5,
                                overflow: "hidden", textOverflow: "ellipsis",
                                WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                        >
                          {para.comment}
                        </Typography>
                      )}
                    </Box>
                  </>
                )}

                {/* Unchanged role with no persistent annotation: optional comment toggle */}
                {!roleChanged && !hasPersistentAnnotation && (
                  <Box>
                    <Tooltip title={hasComment ? "Edit comment" : "Add comment"}>
                      <Button
                        size="small"
                        startIcon={hasComment ? <CommentIcon sx={{ fontSize: "15px !important" }} /> : <CommentOutlinedIcon sx={{ fontSize: "15px !important" }} />}
                        onClick={() => toggleComment(idx)}
                        sx={{
                          color: hasComment ? "primary.main" : "#94A3B8",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          px: 1,
                          py: 0.4,
                          bgcolor: hasComment ? "primary.light" : "transparent",
                          "&:hover": { bgcolor: "primary.light", color: "primary.main" },
                        }}
                      >
                        {hasComment ? "Comment" : "Add note"}
                      </Button>
                    </Tooltip>

                    {showOptional && (
                      <TextField
                        fullWidth multiline minRows={2} maxRows={5} size="small"
                        placeholder="Add a note…"
                        value={para.comment}
                        onChange={(e) => handleCommentChange(idx, e.target.value)}
                        sx={{ mt: 1, "& .MuiOutlinedInput-root": { fontSize: "0.8rem", bgcolor: "#fff" } }}
                      />
                    )}

                    {hasComment && !showOptional && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5, px: 0.5, lineHeight: 1.5,
                              overflow: "hidden", textOverflow: "ellipsis",
                              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {para.comment}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}

      {/* ── Floating save bar ── */}
      {dirty && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed", bottom: 28, right: 28,
            px: 3, py: 1.5, borderRadius: "50px",
            display: "flex", alignItems: "center", gap: 2,
            bgcolor: missingComments.size > 0 ? "#DC2626" : "#1a3a5c",
            color: "#fff",
            backdropFilter: "blur(8px)",
            boxShadow: missingComments.size > 0
              ? "0 8px 24px rgba(220,38,38,0.35)"
              : "0 8px 24px rgba(26,58,92,0.35)",
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {missingComments.size > 0
              ? `${missingComments.size} comment${missingComments.size > 1 ? "s" : ""} required`
              : "Unsaved changes"}
          </Typography>
          <Button
            size="small"
            onClick={handleSave}
            disabled={saving}
            sx={{
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "50px",
              px: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
            }}
            startIcon={<SaveIcon sx={{ fontSize: "16px !important" }} />}
          >
            Save
          </Button>
        </Paper>
      )}
    </Box>
  );
}
