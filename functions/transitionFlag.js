// Backend: transitionFlag. User: dismiss/dispute; admin: rest. Writes reversible AuditEvent.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import { flagTransitionAllowed } from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { flag_id, to_status, reason, reference } = await req.json();
  if (!flag_id || !to_status) return Response.json({ error: "flag_id and to_status required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const flag = await db.Flag.get(flag_id);
  if (!flag) return Response.json({ error: "Flag not found" }, { status: 404 });
  const gate = flagTransitionAllowed(flag.status, to_status, user.role);
  if (!gate.ok) {
    const status = gate.error.includes("Controller") ? 403 : 400;
    return Response.json({ error: gate.error }, { status });
  }
  if (to_status === "dismissed" && !String(reason || "").trim()) {
    return Response.json({ error: "reason required to dismiss" }, { status: 400 });
  }
  if (to_status === "recovered" && !String(reference || "").trim()) {
    return Response.json({ error: "payment reference required" }, { status: 400 });
  }
  if (to_status === "credited" && !String(reference || "").trim()) {
    return Response.json({ error: "credit memo reference required" }, { status: 400 });
  }
  const before = { status: flag.status, dismiss_reason: flag.dismiss_reason || null, reference: flag.reference || null };
  const patch = { status: to_status };
  if (to_status === "dismissed") patch.dismiss_reason = String(reason).trim();
  if (reference) patch.reference = String(reference).trim();
  const updated = await db.Flag.update(flag_id, patch);
  const audit = await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "transition_flag",
    entity_type: "Flag",
    entity_id: flag_id,
    before,
    after: { status: to_status, dismiss_reason: patch.dismiss_reason || null, reference: patch.reference || null },
    reason: reason || null,
    created_at: new Date().toISOString(),
    reversible: true,
    undone: false,
  });
  return Response.json({ flag: updated, audit_event_id: audit.id });
}
