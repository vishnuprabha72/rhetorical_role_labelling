import { Chip } from "@mui/material";

const ROLE_STYLES = {
  FACT:    { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  ISSUE:   { bg: "#FFF1F2", color: "#BE123C", border: "#FECDD3" },
  ARG_P:   { bg: "#FAF5FF", color: "#7E22CE", border: "#E9D5FF" },
  ARG_R:   { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
  LAW:     { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  REASON:  { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  HOLDING: { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  ORDER:   { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  NONE:    { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" },
};

export default function RoleChip({ role, count, size = "small" }) {
  const { bg, color, border } = ROLE_STYLES[role] ?? ROLE_STYLES.NONE;
  const label = count != null ? `${role} (${count})` : role;
  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: bg,
        color,
        border: `1px solid ${border}`,
        fontWeight: 600,
        fontSize: "0.6875rem",
        letterSpacing: "0.02em",
        "& .MuiChip-label": { px: "8px" },
      }}
    />
  );
}
