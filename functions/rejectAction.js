// Backend: rejectAction. Analyst+. Marks SuggestedAction rejected and logs.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { action_id } = await req.json();
  if (!action_id) return Response.json({ error: "action_id required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const action = await db.SuggestedAction.get(action_id);
  if (!action) return Response.json({ error: "Not found" }, { status: 404 });
  await db.SuggestedAction.update(action_id, { status: "rejected" });
  await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "reject_action",
    entity_type: "SuggestedAction",
    entity_id: action_id,
    before: { status: action.status },
    after: { status: "rejected" },
    created_at: new Date().toISOString(),
    reversible: false,
    undone: false,
  });
  return Response.json({ ok: true });
}
