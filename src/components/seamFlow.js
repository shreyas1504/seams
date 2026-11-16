// Seam flows for "Where it slipped": open flags grouped by seam. Shared by the system map and money journey.
// Billing→Cash counts overdue money; every other seam counts recoverable money.

export const SEAM_FLOW_OVERDUE_SEAM = "Billing→Cash";

export const SEAM_FLOW_COLORS = {
  owed: { soft: "#E8A585", drip: "#C2410C", label: "#7C2D12" },
  overdue: { soft: "#F0B8C4", drip: "#9F1239", label: "#881337" },
};

/** Rows: { seam, from, to, cents, n, overdue }. Recoverable seams first (largest first), then overdue. */
export function seamFlowRows(flags) {
  const bySeam = new Map();
  for (const f of flags || []) {
    if ((f.status || "open") !== "open" || !f.seam) continue;
    const overdue = f.seam === SEAM_FLOW_OVERDUE_SEAM;
    if (f.bucket !== (overdue ? "overdue" : "recoverable")) continue;
    if (!bySeam.has(f.seam)) {
      const [from, to] = f.seam.split("→").map((s) => s.trim());
      bySeam.set(f.seam, { seam: f.seam, from, to, cents: 0, n: 0, overdue });
    }
    const row = bySeam.get(f.seam);
    row.cents += f.amount_cents || 0;
    row.n += 1;
  }
  return [...bySeam.values()].sort((a, b) => Number(a.overdue) - Number(b.overdue) || b.cents - a.cents);
}

/** Seam with the most recoverable cents (falls back to the first row). */
export function seamFlowDefault(rows) {
  const rec = rows.filter((r) => !r.overdue);
  return (rec[0] || rows[0] || null)?.seam || null;
}

/** Soft stroke width: 4 + 16 × cents / max. */
export function seamFlowWidth(cents, maxCents) {
  return 4 + (16 * cents) / (maxCents || 1);
}

/** Approximate pixel width of a monospace label at a font size. */
export function seamFlowTextWidth(text, size = 13) {
  return String(text).length * size * 0.6;
}
