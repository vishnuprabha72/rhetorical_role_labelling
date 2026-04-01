import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Tooltip, Stack, Checkbox,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import UploadIcon from "@mui/icons-material/Upload";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CommentOutlinedIcon from "@mui/icons-material/CommentOutlined";
import { listResults, downloadSingle, downloadZip, deleteResult, deleteResultsBatch } from "../client";
import RoleChip from "../components/RoleChip";

const TOP_ROLES = ["FACT", "REASON", "ARG_P", "ARG_R", "LAW", "ISSUE", "HOLDING", "ORDER"];

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listResults()
      .then(({ data }) => setResults(data))
      .catch(() => setError("Could not load results. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  /* ── Selection ── */
  const allSelected  = results.length > 0 && selected.size === results.length;
  const someSelected = selected.size > 0 && selected.size < results.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(results.map((r) => r.file_id)));

  const toggleOne = (id) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* ── Delete ── */
  const handleDeleteOne = async (id) => {
    await deleteResult(id);
    setResults((p) => p.filter((r) => r.file_id !== id));
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
  };

  const handleDeleteSelected = async () => {
    await deleteResultsBatch([...selected]);
    setResults((p) => p.filter((r) => !selected.has(r.file_id)));
    setSelected(new Set());
  };

  /* ── Download ── */
  const handleDownload = async (id) => {
    const { data } = await downloadSingle(id);
    const url = URL.createObjectURL(data);
    Object.assign(document.createElement("a"), { href: url, download: `${id}.json` }).click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const { data } = await downloadZip();
    const url = URL.createObjectURL(data);
    Object.assign(document.createElement("a"), { href: url, download: "judgments.zip" }).click();
    URL.revokeObjectURL(url);
  };

  /* ── Stats ── */
  const totalParas = results.reduce((s, r) => s + r.total_paragraphs, 0);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 12 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, px: { xs: 2, sm: 4 }, pb: 8 }}>

      {/* ── Page header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ mb: 0.25 }}>Extracted Judgments</Typography>
          <Typography variant="body2" color="text.secondary">
            Review, annotate, and download extracted judgment paragraphs.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
          {results.length > 0 && (
            <Button variant="outlined" startIcon={<FolderZipIcon />} onClick={handleDownloadAll} size="small">
              Download All
            </Button>
          )}
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => navigate("/")} size="small">
            Upload More
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Stat cards ── */}
      {results.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2, mb: 3 }}>
          {[
            { label: "Total Judgments", value: results.length },
            { label: "Total Paragraphs", value: totalParas.toLocaleString() },
            { label: "Annotated", value: results.filter(r => Object.keys(r.role_distribution).some(k => k !== "NONE")).length },
          ].map(({ label, value }) => (
            <Paper key={label} elevation={1} sx={{ px: 2.5, py: 2, borderRadius: "12px" }}>
              <Typography variant="overline" color="text.secondary" display="block">{label}</Typography>
              <Typography variant="h5" sx={{ mt: 0.25, fontWeight: 700 }}>{value}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <Paper
          elevation={2}
          sx={{
            mb: 2, px: 2.5, py: 1.25,
            borderRadius: "10px",
            display: "flex", alignItems: "center", gap: 2,
            bgcolor: "#EBF2FA",
            border: "1px solid #BFDBFE",
          }}
        >
          <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ flex: 1 }}>
            {selected.size} judgment{selected.size > 1 ? "s" : ""} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteSelected}
            sx={{ bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } }}
          >
            Delete selected
          </Button>
          <Button size="small" sx={{ color: "#64748B" }} onClick={() => setSelected(new Set())}>
            Cancel
          </Button>
        </Paper>
      )}

      {/* ── Empty state ── */}
      {results.length === 0 && !error && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ p: 8, textAlign: "center", borderRadius: "16px", borderStyle: "dashed" }}
        >
          <DescriptionOutlinedIcon sx={{ fontSize: 52, color: "#CBD5E1", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
            No judgments yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload a Supreme Court judgment PDF to get started.
          </Typography>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => navigate("/")}>
            Upload a Judgment
          </Button>
        </Paper>
      )}

      {/* ── Table ── */}
      {results.length > 0 && (
        <TableContainer
          component={Paper}
          elevation={1}
          sx={{ borderRadius: "12px" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} size="small" />
                </TableCell>
                <TableCell>File</TableCell>
                <TableCell align="center" sx={{ width: 110 }}>Paragraphs</TableCell>
                <TableCell sx={{ width: 400 }}>Role Distribution</TableCell>
                <TableCell align="center" sx={{ width: 100 }}>
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                    <CommentOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                    <span>Comments</span>
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ width: 120, pr: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {results.map((r) => (
                <TableRow
                  key={r.file_id}
                  hover
                  selected={selected.has(r.file_id)}
                >
                  <TableCell padding="checkbox" sx={{ pl: 2 }}>
                    <Checkbox checked={selected.has(r.file_id)} onChange={() => toggleOne(r.file_id)} size="small" />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.2 }}>
                      {r.source_file}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.file_id}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={r.total_paragraphs}
                      size="small"
                      sx={{ bgcolor: "#EBF2FA", color: "#1a3a5c", fontWeight: 700, border: "1px solid #BFDBFE" }}
                    />
                  </TableCell>

                  <TableCell>
                    {r.old_role_distribution && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Current
                      </Typography>
                    )}
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {TOP_ROLES
                        .filter((role) => r.role_distribution[role] > 0)
                        .map((role) => (
                          <RoleChip key={role} role={role} count={r.role_distribution[role]} />
                        ))}
                    </Stack>
                    {r.old_role_distribution && (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, mb: 0.5, fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Original
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ opacity: 0.7 }}>
                          {TOP_ROLES
                            .filter((role) => r.old_role_distribution[role] > 0)
                            .map((role) => (
                              <RoleChip key={role} role={role} count={r.old_role_distribution[role]} />
                            ))}
                        </Stack>
                      </>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    {r.comment_count > 0 ? (
                      <Chip
                        label={r.comment_count}
                        size="small"
                        sx={{ bgcolor: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", fontWeight: 700 }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  <TableCell align="right" sx={{ pr: 2 }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Annotate">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/annotate/${r.file_id}`)}>
                          <EditIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download JSON">
                        <IconButton size="small" onClick={() => handleDownload(r.file_id)} sx={{ color: "#64748B" }}>
                          <DownloadIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteOne(r.file_id)}>
                          <DeleteIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
