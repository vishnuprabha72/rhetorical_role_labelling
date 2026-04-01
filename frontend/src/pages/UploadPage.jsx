import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, LinearProgress, Paper, Alert,
  List, ListItem, ListItemText, IconButton, Chip,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { extractSingle, extractBatch, listResults } from "../client";

function toFileId(filename) {
  return filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

const CHUNK_SIZE = 10;

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const [files, setFiles]           = useState([]);
  const [progress, setProgress]     = useState(0);
  const [doneCount, setDoneCount]   = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [existingIds, setExistingIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    listResults()
      .then(({ data }) => setExistingIds(new Set(data.map((r) => r.file_id))))
      .catch(() => {});
  }, []);

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [...prev, ...accepted.filter((f) => f.name.endsWith(".pdf"))]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setProgress(0);
    setDoneCount(0);

    try {
      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0]);
        const { data } = await extractSingle(fd, setProgress);
        const fileId = data.source_file.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
        navigate(`/annotate/${fileId}`);
      } else {
        const chunks = [];
        for (let i = 0; i < files.length; i += CHUNK_SIZE) chunks.push(files.slice(i, i + CHUNK_SIZE));
        let completed = 0;
        for (const chunk of chunks) {
          const fd = new FormData();
          chunk.forEach((f) => fd.append("files", f));
          await extractBatch(fd);
          completed += chunk.length;
          setDoneCount(completed);
          setProgress(Math.round((completed / files.length) * 100));
        }
        navigate("/results");
      }
    } catch (e) {
      setError(e.response?.data?.detail ?? "Upload failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "flex-start", justifyContent: "center", pt: 8, px: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 560 }}>

        {/* Page heading */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h5" sx={{ mb: 0.75 }}>
            Upload Judgments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload one or more Supreme Court judgment PDFs.<br />
            The system extracts paragraphs and assigns rhetorical role labels.
          </Typography>
        </Box>

        {/* Drop zone */}
        <Paper
          {...getRootProps()}
          elevation={0}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "#CBD5E1",
            borderRadius: "12px",
            p: 5,
            textAlign: "center",
            cursor: "pointer",
            bgcolor: isDragActive ? "primary.light" : "#FAFBFD",
            transition: "all 0.18s ease",
            "&:hover": { borderColor: "primary.main", bgcolor: "primary.light" },
            outline: "none",
          }}
        >
          <input {...getInputProps()} />
          <Box
            sx={{
              width: 52, height: 52,
              borderRadius: "14px",
              bgcolor: isDragActive ? "primary.main" : "#E2E8F0",
              display: "flex", alignItems: "center", justifyContent: "center",
              mx: "auto", mb: 2,
              transition: "all 0.18s ease",
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 26, color: isDragActive ? "#fff" : "#64748B" }} />
          </Box>
          <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
            {isDragActive ? "Release to upload" : "Drag & drop PDF files here"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            or click to browse from your computer
          </Typography>
          <Box
            component="span"
            sx={{
              display: "inline-block",
              px: 2, py: 0.5,
              borderRadius: 6,
              bgcolor: "#E2E8F0",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#475569",
            }}
          >
            PDF only
          </Box>
        </Paper>

        {/* File list */}
        {files.length > 0 && (
          <Paper
            elevation={1}
            sx={{ mt: 2, borderRadius: "12px", overflow: "hidden" }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="overline" color="text.secondary">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </Typography>
              <Button size="small" sx={{ color: "#94A3B8", fontSize: "0.75rem", py: 0, minWidth: 0 }} onClick={() => setFiles([])}>
                Clear all
              </Button>
            </Box>
            <List disablePadding dense>
              {files.map((f, i) => {
                const isDuplicate = existingIds.has(toFileId(f.name));
                return (
                  <ListItem
                    key={i}
                    divider={i < files.length - 1}
                    sx={{ px: 2, py: 1, bgcolor: isDuplicate ? "#FFFBEB" : "transparent" }}
                    secondaryAction={
                      <IconButton edge="end" size="small" onClick={() => removeFile(i)} sx={{ color: "#94A3B8" }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: isDuplicate ? "#B45309" : "#ef4444", mr: 1.5, flexShrink: 0 }} />
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 260 }}>{f.name}</Typography>
                          {isDuplicate && (
                            <Chip label="Already uploaded" size="small" sx={{ bgcolor: "#FDE68A", color: "#92400E", fontSize: "0.65rem", height: 18, "& .MuiChip-label": { px: "6px" } }} />
                          )}
                        </Box>
                      }
                      secondary={<Typography variant="caption" color={isDuplicate ? "#B45309" : "text.secondary"}>{fmt(f.size)}{isDuplicate ? " · Will overwrite existing" : ""}</Typography>}
                      sx={{ my: 0 }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        )}

        {/* Progress */}
        {loading && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
              <Typography variant="caption" fontWeight={500}>
                {files.length > 1 ? `Processing ${doneCount} of ${files.length} files…` : "Processing…"}
              </Typography>
              <Typography variant="caption" color="text.secondary">{progress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {/* Duplicate warning */}
        {files.some((f) => existingIds.has(toFileId(f.name))) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {files.filter((f) => existingIds.has(toFileId(f.name))).map((f) => f.name).join(", ")}{" "}
            {files.filter((f) => existingIds.has(toFileId(f.name))).length === 1 ? "is" : "are"} already uploaded. Re-uploading will overwrite the existing result.
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Upload button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!files.length || loading}
          onClick={handleUpload}
          sx={{ mt: 3, py: 1.5 }}
        >
          {loading
            ? "Processing…"
            : files.length > 1
              ? `Extract ${files.length} Judgments`
              : "Extract Paragraphs"}
        </Button>
      </Box>
    </Box>
  );
}
