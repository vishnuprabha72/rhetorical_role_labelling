import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import { useNavigate, useLocation } from "react-router-dom";

const NAV = [
  { label: "Upload", path: "/" },
  { label: "Results", path: "/results" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ px: { xs: 2, sm: 4 }, minHeight: "60px !important", gap: 2 }}>
        {/* Brand */}
        <Box
          onClick={() => navigate("/")}
          sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer", flexGrow: 1 }}
        >
          <Box
            sx={{
              width: 34, height: 34, borderRadius: "9px",
              background: "linear-gradient(135deg, #1a3a5c 0%, #2e6da4 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 6px rgba(26,58,92,0.35)",
              flexShrink: 0,
            }}
          >
            <GavelIcon sx={{ fontSize: 18, color: "#fff" }} />
          </Box>
          <Box>
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, color: "#0F172A", lineHeight: 1.2, letterSpacing: "-0.01em" }}
            >
              RhetoricalLabel
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748B", lineHeight: 1 }}>
              SC Judgment Annotator
            </Typography>
          </Box>
        </Box>

        {/* Nav links */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {NAV.map(({ label, path }) => {
            const active = pathname === path;
            return (
              <Button
                key={path}
                onClick={() => navigate(path)}
                size="small"
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 500,
                  color: active ? "primary.main" : "#64748B",
                  bgcolor: active ? "primary.light" : "transparent",
                  "&:hover": {
                    bgcolor: active ? "primary.light" : "#F1F5F9",
                    color: active ? "primary.main" : "#0F172A",
                  },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
