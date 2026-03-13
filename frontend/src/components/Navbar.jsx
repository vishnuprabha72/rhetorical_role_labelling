import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const nav = [
    { label: "Upload", path: "/" },
    { label: "Results", path: "/results" },
  ];

  return (
    <AppBar position="sticky" elevation={1} sx={{ bgcolor: "primary.main" }}>
      <Toolbar>
        <GavelIcon sx={{ mr: 1, color: "secondary.main" }} />
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, color: "#fff", cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          Rhetorical Label
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {nav.map(({ label, path }) => (
            <Button
              key={path}
              onClick={() => navigate(path)}
              sx={{
                color: pathname === path ? "secondary.main" : "#ffffffcc",
                borderBottom: pathname === path ? "2px solid" : "none",
                borderColor: "secondary.main",
                borderRadius: 0,
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
