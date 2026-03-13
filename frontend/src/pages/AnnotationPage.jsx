import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Select, MenuItem, FormControl,
  Button, Chip, CircularProgress, Alert, Divider,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { getResult, saveCorrections, downloadSingle } from "../client";
import RoleChip from "../components/RoleChip";

const ROLES = ["NONE", "FACT", "ISSUE", "ARG_P", "ARG_R", "LAW", "REASON", "HOLDING", "ORDER"];

const ROLE_COLORS = {
  FACT:    "#e3f2fd",
  ISSUE:   "#fce4ec",
  ARG_P:   "#f3e5f5",
  ARG_R:   "#ede7f6",
  LAW:     "#e8f5e9",
  REASON:  "#fff8e1",
  HOLDING: "#fbe9e7",
  ORDER:   "#e0f2f1",
  NONE:    "#fafafa",
};

export default function AnnotationPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResult(fileId)
      .then(({ data }) => {
        setResult(data);
        setParagraphs(data.paragraphs.map((p) => ({ ...p })));
      })
      .catch(() => setError("Could not load judgment. Upload it first."));
  }, [fileId]);

  const handleRoleChange = (idx, newRole) => {
    setParagraphs((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], rhetorical_role: newRole };
      return copy;
    });
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const corrections = paragraphs.map((p) => ({
        number: p.number,
        rhetorical_role: p.rhetorical_role,
      }));
      await saveCorrections(fileId, corrections);
      setDirty(false);
      setSaved(true);
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const { data } = await downloadSingle(fileId);
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result && !error) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 700, mx: "auto", mt: 6 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} sx={{ mt: 2 }} onClick={() => navigate("/")}>
          Back to Upload
        </Button>
      </Box>
    );
  }

  // Role distribution counts from current state
  const dist = paragraphs.reduce((acc, p) => {
    acc[p.rhetorical_role] = (acc[p.rhetorical_role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, px: 2, pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            size="small"
            onClick={() => navigate("/results")}
            sx={{ mb: 1 }}
          >
            All Results
          </Button>
          <Typography variant="h5" fontWeight={700}>
            {result.source_file}
          </Typography>
          {result.metadata.parties?.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {result.metadata.parties.map((p) => p.name).join(" vs. ")}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            size="small"
          >
            Download JSON
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!dirty || saving}
            size="small"
          >
            {saving ? "Saving…" : "Save Corrections"}
          </Button>
        </Box>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Corrections saved!</Alert>}

      {/* Role distribution summary */}
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 3, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ mr: 1, alignSelf: "center", fontWeight: 600 }}>
          Distribution:
        </Typography>
        {Object.entries(dist).map(([role, count]) => (
          <Chip
            key={role}
            label={`${role} ${count}`}
            size="small"
            sx={{
              bgcolor: ROLE_COLORS[role] ?? "#fafafa",
              fontWeight: 600,
              fontSize: "0.72rem",
            }}
          />
        ))}
      </Paper>

      {/* Metadata accordion */}
      <Accordion disableGutters elevation={0} variant="outlined" sx={{ mb: 3, borderRadius: "8px !important" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Case Metadata
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "4px 16px" }}>
            {[
              ["Court", result.metadata.court],
              ["Jurisdiction", result.metadata.jurisdiction],
              ["Case Numbers", result.metadata.case_numbers?.join(", ")],
              ["Coram", result.metadata.coram?.join(", ")],
              ["Reportable", result.metadata.reportable != null ? String(result.metadata.reportable) : null],
            ]
              .filter(([, v]) => v)
              .map(([label, val]) => (
                <>
                  <Typography key={label + "-k"} variant="caption" color="text.secondary" fontWeight={600}>
                    {label}
                  </Typography>
                  <Typography key={label + "-v"} variant="caption">
                    {val}
                  </Typography>
                </>
              ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Paragraph cards */}
      {paragraphs.map((para, idx) => (
        <Paper
          key={para.number}
          elevation={0}
          variant="outlined"
          sx={{
            mb: 1.5,
            borderRadius: 2,
            borderLeft: "4px solid",
            borderLeftColor: `${ROLE_COLORS[para.rhetorical_role] === "#fafafa" ? "#e0e0e0" : para.rhetorical_role}`,
            bgcolor: ROLE_COLORS[para.rhetorical_role] ?? "#fafafa",
            transition: "background-color 0.2s",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", p: 2, gap: 2 }}>
            {/* Para number */}
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ minWidth: 36, color: "text.secondary", mt: 0.2 }}
            >
              {para.label || para.number}
            </Typography>

            {/* Para text */}
            <Typography
              variant="body2"
              sx={{ flex: 1, lineHeight: 1.7, color: "text.primary" }}
            >
              {para.text}
            </Typography>

            {/* Role selector */}
            <FormControl size="small" sx={{ minWidth: 120, flexShrink: 0 }}>
              <Select
                value={para.rhetorical_role}
                onChange={(e) => handleRoleChange(idx, e.target.value)}
                sx={{ fontSize: "0.8rem" }}
              >
                {ROLES.map((r) => (
                  <MenuItem key={r} value={r}>
                    <RoleChip role={r} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      ))}

      {/* Floating save bar */}
      {dirty && (
        <Paper
          elevation={4}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            borderRadius: 3,
            bgcolor: "primary.main",
            color: "#fff",
          }}
        >
          <Typography variant="body2">Unsaved changes</Typography>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
        </Paper>
      )}
    </Box>
  );
}
