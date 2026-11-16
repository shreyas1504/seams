// Backend function: runChecks. Controller only. Recomputes every flag from current data (never hardcoded),
// upserts by stable_key, never deletes, protects sent flags (-> needs_review), logs an AuditEvent.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import { runEngine, reconcileFlags, DEFAULT_SETTINGS } from "../src/lib/engine/engine.js"; // BASE44: engine is inlined above by make-transfer

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const db = base44.asServiceRole.entities;
  const all = (E) => db[E].list(undefined, 5000);
  const [contracts, shipments, invoices, bills, returns, settingRows, existing, oldRuled, oldPatterns] = await Promise.all([
    all("Contract"), all("Shipment"), all("Invoice"), all("VendorBill"), all("Return"), all("Setting"), all("Flag"), all("RuledOut"), all("Pattern")]);
  const s = settingRows[0] || {};
  const settings = { ...DEFAULT_SETTINGS, ...s, rule_enabled: { ...DEFAULT_SETTINGS.rule_enabled, ...(s.rule_enabled || {}) } };
  const out = runEngine({ contracts, shipments, invoices, bills, returns }, settings);
  const { create, update, counts } = reconcileFlags(existing, out.flags);
  if (create.length) await db.Flag.bulkCreate(create);
  for (const u of update) await db.Flag.update(u.id, u.data);
  for (const r of oldRuled) await db.RuledOut.delete(r.id);
  if (out.ruledOut.length) await db.RuledOut.bulkCreate(out.ruledOut);
  for (const p of oldPatterns) await db.Pattern.delete(p.id);
  if (out.patterns.length) await db.Pattern.bulkCreate(out.patterns);
  await db.AuditEvent.create({ actor_email: user.email, actor_role: user.role, action: "run_checks", entity_type: "Flag",
    after: counts, created_at: new Date().toISOString() });
  return Response.json({ ok: true, counts, totals: out.totals, needs_review: out.needsReview });
}
