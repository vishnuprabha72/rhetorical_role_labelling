import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Tooltip, Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import UploadIcon from "@mui/icons-material/Upload";
import { listResults, downloadSingle, downloadZip } from "../client";
import RoleChip from "../components/RoleChip";

const TOP_ROLES = ["FACT", "ISSUE", "REASON", "HOLDING", "ORDER"];

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listResults()
      .then(({ data }) => setResults(data))
      .catch(() => setError("Could not load results. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (fileId) => {
    const { data } = await downloadSingle(fileId);
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const { data } = await downloadZip();
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "judgments.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4, px: 2, pb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ flex: 1 }}>
          Extracted Judgments
        </Typography>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => navigate("/")}
        >
          Upload More
        </Button>
        {results.length > 0 && (
          <Button
            variant="contained"
            startIcon={<FolderZipIcon />}
            onClick={handleDownloadAll}
          >
            Download All (ZIP)
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {results.length === 0 && !error && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ p: 6, textAlign: "center", borderRadius: 2 }}
        >
          <Typography variant="h6" color="text.secondary">
            No judgments extracted yet.
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            sx={{ mt: 2 }}
            onClick={() => navigate("/")}
          >
            Upload a Judgment
          </Button>
        </Paper>
      )}

      {results.length > 0 && (
        <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f0f4fa" }}>
                <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Paragraphs</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role Distribution</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.file_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
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
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {Object.entries(r.role_distribution)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([role, count]) => (
                          <Tooltip key={role} title={`${role}: ${count}`}>
                            <Box>
                              <RoleChip role={role} />
                            </Box>
                          </Tooltip>
                        ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Annotate / Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/annotate/${r.file_id}`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download JSON">
                        <IconButton
                          size="small"
                          onClick={() => handleDownload(r.file_id)}
                        >
                          <DownloadIcon fontSize="small" />
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
