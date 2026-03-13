import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/extract`
    : "/api/extract",
});

export const extractSingle = (formData, onProgress) =>
  client.post("/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
  });

export const extractBatch = (formData, onProgress) =>
  client.post("/batch", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
  });

export const listResults = () => client.get("/results");

export const getResult = (fileId) => client.get(`/results/${fileId}`);

export const saveCorrections = (fileId, corrections) =>
  client.post(`/corrections/${fileId}`, { corrections });

export const downloadSingle = (fileId) =>
  client.get(`/download/${fileId}`, { responseType: "blob" });

export const downloadZip = () =>
  client.get("/download-zip", { responseType: "blob" });
