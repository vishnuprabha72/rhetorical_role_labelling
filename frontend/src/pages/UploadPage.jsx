import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, LinearProgress, Paper,
  List, ListItem, ListItemText, Alert, Chip, Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { extractSingle, extractBatch } from "../client";

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
    try {
      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0]);
        const { data } = await extractSingle(fd, setProgress);
        const fileId = data.source_file.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
        navigate(`/annotate/${fileId}`);
      } else {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        await extractBatch(fd, setProgress);
        navigate("/results");
      }
    } catch (e) {
      setError(e.response?.data?.detail ?? "Upload failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", mt: 6, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Upload Judgment PDF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload one or more Indian Supreme Court judgment PDFs. The system extracts paragraphs
        and assigns rhetorical role labels (FACT, ISSUE, REASON, HOLDING…).
      </Typography>

      {/* Drop zone */}
      <Paper
        {...getRootProps()}
        elevation={0}
        sx={{
          border: "2px dashed",
          borderColor: isDragActive ? "primary.main" : "#c0c8d8",
          borderRadius: 2,
          p: 5,
          textAlign: "center",
          cursor: "pointer",
          bgcolor: isDragActive ? "#e8edf5" : "background.paper",
          transition: "all 0.2s",
          "&:hover": { borderColor: "primary.main", bgcolor: "#f0f4fa" },
        }}
      >
        <input {...getInputProps()} />
        <UploadFileIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
        <Typography variant="h6">
          {isDragActive ? "Drop PDFs here…" : "Drag & drop PDFs here"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          or click to browse
        </Typography>
      </Paper>

      {/* File list */}
      {files.length > 0 && (
        <Paper elevation={0} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
          <List dense disablePadding>
            {files.map((f, i) => (
              <Box key={i}>
                <ListItem
                  secondaryAction={
                    <Chip label="Remove" size="small" onClick={() => removeFile(i)} />
                  }
                >
                  <PictureAsPdfIcon sx={{ mr: 1, color: "#e53935", fontSize: 20 }} />
                  <ListItemText
                    primary={f.name}
                    secondary={`${(f.size / 1024).toFixed(1)} KB`}
                  />
                </ListItem>
                {i < files.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        </Paper>
      )}

      {/* Progress */}
      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary">
            Uploading… {progress}%
          </Typography>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        disabled={!files.length || loading}
        onClick={handleUpload}
        sx={{ mt: 3, px: 5 }}
      >
        {loading ? "Processing…" : files.length > 1 ? `Extract ${files.length} PDFs` : "Extract Paragraphs"}
      </Button>
    </Box>
  );
}
