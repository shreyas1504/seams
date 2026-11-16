// System pastels and seam display helpers (design tokens, no numbers).
export const SYSTEM_TINT = {
  CRM: { bg: "#EAF1FD", ink: "#1E3A8A" },
  Warehouse: { bg: "#E3F4F6", ink: "#155E75" },
  Billing: { bg: "#ECF3E1", ink: "#3F6212" },
  AP: { bg: "#F3EDFB", ink: "#6B21A8" },
  Returns: { bg: "#FFF4E5", ink: "#9A4A00" },
};

/** "AP→Vendors" -> "AP" (the system where the seam starts). */
export function seamSystem(seam) {
  return String(seam || "").split("→")[0].trim();
}

/** "AP→Vendors" -> "AP → Vendors". */
export function seamLabel(seam) {
  return String(seam || "").split("→").map((s) => s.trim()).join(" → ");
}

export function seamTint(seam) {
  return SYSTEM_TINT[seamSystem(seam)] || { bg: "#F1ECE4", ink: "#1C1917" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-01" -> "Aug 1" without timezone drift. */
export function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}
