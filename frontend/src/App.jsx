import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import UploadPage from "./pages/UploadPage";
import AnnotationPage from "./pages/AnnotationPage";
import ResultsPage from "./pages/ResultsPage";
import { Box } from "@mui/material";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/annotate/:fileId" element={<AnnotationPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}
