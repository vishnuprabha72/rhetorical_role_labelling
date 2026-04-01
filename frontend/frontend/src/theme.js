import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary:    { main: "#1a3a5c", light: "#EBF2FA", dark: "#12293f" },
    secondary:  { main: "#c8a951", light: "#FDF6E3" },
    success:    { main: "#16a34a", light: "#f0fdf4" },
    error:      { main: "#dc2626", light: "#fef2f2" },
    warning:    { main: "#d97706", light: "#fffbeb" },
    background: { default: "#F1F5F9", paper: "#ffffff" },
    text:       { primary: "#0F172A", secondary: "#64748B" },
    divider:    "#E2E8F0",
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 15,
    h4:      { fontWeight: 700, fontSize: "1.625rem", letterSpacing: "-0.02em", lineHeight: 1.3 },
    h5:      { fontWeight: 700, fontSize: "1.25rem",  letterSpacing: "-0.01em", lineHeight: 1.4 },
    h6:      { fontWeight: 600, fontSize: "1.0625rem" },
    body1:   { fontSize: "0.9375rem", lineHeight: 1.65 },
    body2:   { fontSize: "0.875rem",  lineHeight: 1.65 },
    caption: { fontSize: "0.75rem",   lineHeight: 1.5, color: "#64748B" },
    overline:{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
    button:  { fontWeight: 600, letterSpacing: "0.01em" },
  },

  shape: { borderRadius: 10 },

  shadows: [
    "none",
    "0 1px 2px rgba(0,0,0,0.06)",
    "0 1px 4px rgba(0,0,0,0.08)",
    "0 2px 8px rgba(0,0,0,0.08)",
    "0 4px 16px rgba(0,0,0,0.08)",
    "0 8px 24px rgba(0,0,0,0.10)",
    "0 12px 32px rgba(0,0,0,0.10)",
    "0 16px 48px rgba(0,0,0,0.12)",
    ...Array(17).fill("0 16px 48px rgba(0,0,0,0.12)"),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": { boxSizing: "border-box" },
        body: { fontSize: "0.9375rem" },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          fontSize: "0.875rem",
          padding: "7px 16px",
        },
        sizeSmall:  { padding: "5px 12px", fontSize: "0.8125rem" },
        sizeLarge:  { padding: "10px 24px", fontSize: "0.9375rem" },
        outlined:   { borderColor: "#CBD5E1", "&:hover": { borderColor: "#94A3B8", bgcolor: "#F8FAFC" } },
        containedPrimary: {
          background: "linear-gradient(135deg, #1a3a5c 0%, #1e4a78 100%)",
          "&:hover": { background: "linear-gradient(135deg, #12293f 0%, #1a3a5c 100%)" },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { border: "1px solid #E2E8F0", boxShadow: "none" },
        elevation1: { boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)" },
        elevation2: { boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)" },
        elevation4: { boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.03)" },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#0F172A",
          boxShadow: "0 1px 0 #E2E8F0",
        },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 10, overflow: "hidden" },
      },
    },

    MuiTable: {
      styleOverrides: {
        root: { borderCollapse: "separate", borderSpacing: 0 },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          borderBottom: "1px solid #F1F5F9",
          padding: "13px 18px",
          color: "#0F172A",
        },
        head: {
          fontWeight: 600,
          fontSize: "0.6875rem",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "#64748B",
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          padding: "10px 18px",
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: "none" },
          "&.MuiTableRow-hover:hover": { backgroundColor: "#F8FAFC" },
          "&.Mui-selected":            { backgroundColor: "#EBF2FA" },
          "&.Mui-selected:hover":      { backgroundColor: "#dbeafe" },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.6875rem", borderRadius: 6, height: 24 },
        sizeSmall: { fontSize: "0.6875rem", height: 22 },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: "0.875rem",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#CBD5E1" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#94A3B8" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1a3a5c", borderWidth: 1.5 },
        },
      },
    },

    MuiSelect: {
      styleOverrides: { root: { borderRadius: 8 } },
    },

    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #E2E8F0",
          borderRadius: "10px !important",
          "&:before": { display: "none" },
        },
      },
    },

    MuiAccordionSummary: {
      styleOverrides: {
        root: { padding: "0 16px", minHeight: 48 },
        content: { margin: "12px 0" },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root:          { borderRadius: 4, height: 6, backgroundColor: "#E2E8F0" },
        bar:           { borderRadius: 4 },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: "0.875rem" },
        standardSuccess: { backgroundColor: "#f0fdf4", color: "#15803d" },
        standardError:   { backgroundColor: "#fef2f2", color: "#b91c1c" },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.75rem",
          borderRadius: 6,
          backgroundColor: "#0F172A",
          padding: "5px 10px",
        },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: { color: "#CBD5E1", "&.Mui-checked": { color: "#1a3a5c" } },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: "#E2E8F0" } },
    },
  },
});

export default theme;
