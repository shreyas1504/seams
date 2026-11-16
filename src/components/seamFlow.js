// Seam flows for "Where it slipped": open flags grouped by seam. Shared by the system map and money journey.
// Billing→Cash counts overdue money; every other seam counts recoverable money.

export const SEAM_FLOW_OVERDUE_SEAM = "Billing→Cash";

export const SEAM_FLOW_COLORS = {
  owed: { soft: "#E8A585", drip: "#C2410C", label: "#7C2D12" },
  credit: { soft: "#9FD4C8", drip: "#0F766E", label: "#115E59" },
  overdue: { soft: "#E9A3B4", drip: "#9F1239", label: "#881337" },
};

/**
 * Rows: { seam, from, to, cents, n, overdue, creditOnly }. Recoverable seams first (largest first), then overdue,
 * then seams whose only open findings are credits we owe (so a credit-only seam still gets a pill and a connector).
 */
export function seamFlowRows(flags) {
  const bySeam = new Map();
  const credits = new Map();
  for (const f of flags || []) {
    if ((f.status || "open") !== "open" || !f.seam) continue;
    const overdue = f.seam === SEAM_FLOW_OVERDUE_SEAM;
    if (f.bucket === "credit_owed") {
      const c = credits.get(f.seam) || { cents: 0, n: 0 };
      c.cents += f.amount_cents || 0;
      c.n += 1;
      credits.set(f.seam, c);
      continue;
    }
    if (f.bucket !== (overdue ? "overdue" : "recoverable")) continue;
    if (!bySeam.has(f.seam)) {
      const [from, to] = f.seam.split("→").map((s) => s.trim());
      bySeam.set(f.seam, { seam: f.seam, from, to, cents: 0, n: 0, overdue, creditOnly: false });
    }
    const row = bySeam.get(f.seam);
    row.cents += f.amount_cents || 0;
    row.n += 1;
  }
  for (const [seam, c] of credits) {
    if (bySeam.has(seam)) continue;
    const [from, to] = seam.split("→").map((s) => s.trim());
    bySeam.set(seam, { seam, from, to, cents: c.cents, n: c.n, overdue: false, creditOnly: true });
  }
  const rank = (r) => (r.creditOnly ? 2 : r.overdue ? 1 : 0);
  return [...bySeam.values()].sort((a, b) => rank(a) - rank(b) || b.cents - a.cents);
}

/** Seam with the most recoverable cents (falls back to the first row). */
export function seamFlowDefault(rows) {
  const rec = rows.filter((r) => !r.overdue && !r.creditOnly);
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
