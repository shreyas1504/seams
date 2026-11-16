// Backend: undoAction. Admin only. Reverses reversible AuditEvents; sends cannot be undone.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { audit_event_id } = await req.json();
  if (!audit_event_id) return Response.json({ error: "audit_event_id required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const ev = await db.AuditEvent.get(audit_event_id);
  if (!ev) return Response.json({ error: "AuditEvent not found" }, { status: 404 });
  if (ev.action === "send_letter" || ev.reversible === false) {
    return Response.json({ error: "Send a correction instead" }, { status: 409 });
  }
  if (!ev.reversible || ev.undone) {
    return Response.json({ error: "Event is not reversible" }, { status: 409 });
  }
  if (ev.action === "transition_flag" && ev.entity_type === "Flag" && ev.entity_id) {
    const flag = await db.Flag.get(ev.entity_id);
    if (flag) {
      await db.Flag.update(ev.entity_id, {
        status: ev.before?.status || "open",
        dismiss_reason: ev.before?.dismiss_reason ?? null,
        reference: ev.before?.reference ?? null,
      });
    }
  }
  await db.AuditEvent.update(ev.id, { undone: true });
  await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "undo",
    entity_type: ev.entity_type,
    entity_id: ev.entity_id,
    before: ev.after || null,
    after: ev.before || null,
    reason: `Undo of ${ev.action}`,
    created_at: new Date().toISOString(),
    reversible: false,
    undone: false,
  });
  return Response.json({ ok: true });
}
