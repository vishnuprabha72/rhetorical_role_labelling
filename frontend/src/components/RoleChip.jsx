import { Chip } from "@mui/material";

const ROLE_COLORS = {
  FACT:    { bg: "#e3f2fd", color: "#1565c0" },
  ISSUE:   { bg: "#fce4ec", color: "#880e4f" },
  ARG_P:   { bg: "#f3e5f5", color: "#6a1b9a" },
  ARG_R:   { bg: "#ede7f6", color: "#4527a0" },
  LAW:     { bg: "#e8f5e9", color: "#2e7d32" },
  REASON:  { bg: "#fff8e1", color: "#f57f17" },
  HOLDING: { bg: "#fbe9e7", color: "#bf360c" },
  ORDER:   { bg: "#e0f2f1", color: "#004d40" },
  NONE:    { bg: "#f5f5f5", color: "#616161" },
};

export default function RoleChip({ role }) {
  const { bg, color } = ROLE_COLORS[role] ?? ROLE_COLORS.NONE;
  return (
    <Chip
      label={role}
      size="small"
      sx={{ bgcolor: bg, color, fontWeight: 700, fontSize: "0.7rem" }}
    />
  );
}
