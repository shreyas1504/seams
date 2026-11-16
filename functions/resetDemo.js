// Backend function: resetDemo. Controller only. Clears data + findings (never the AuditEvent log), restores settings.
// The client then calls importRows for each seed file and runChecks.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
const CLEAR = ["Contract", "Shipment", "Invoice", "VendorBill", "Return", "Flag", "RuledOut", "Pattern", "Letter", "SuggestedAction", "Setting"];

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const db = base44.asServiceRole.entities;
  for (const E of CLEAR) for (const r of await db[E].list(undefined, 5000)) await db[E].delete(r.id);
  await db.Setting.create({ as_of_date: "2026-11-13", overdue_days: 30, po_abs_cents: 2500, po_pct: 0.01, match_window_days: 10,
    rule_enabled: {}, four_eyes_threshold_cents: 500000 });
  await db.AuditEvent.create({ actor_email: user.email, actor_role: user.role, action: "reset_demo", entity_type: "All", created_at: new Date().toISOString() });
  return Response.json({ ok: true });
}
