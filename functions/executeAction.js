// Backend: executeAction. Admin only. Runs proposed SuggestedAction through real functions.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { action_id } = await req.json();
  if (!action_id) return Response.json({ error: "action_id required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const action = await db.SuggestedAction.get(action_id);
  if (!action) return Response.json({ error: "Not found" }, { status: 404 });
  if (action.status !== "proposed") {
    return Response.json({ error: `Action status is ${action.status}` }, { status: 409 });
  }

  let result = null;
  let undoable = false;
  const party = action.params?.party;

  // In Base44 each backend function is deployed separately: call siblings through the SDK, never a file import.
  const call = async (name, payload) => {
    try {
      return { ok: true, data: (await base44.functions.invoke(name, payload)).data };
    } catch (e) {
      return { ok: false, status: e?.response?.status || 500, data: e?.response?.data || { error: e?.message || `${name} failed` } };
    }
  };

  if (action.action_type === "send_letter" || action.action_type === "send_correction") {
    const kind = action.action_type === "send_correction" ? "correction" : "customer";
    const r = await call("sendLetter", { party, kind, tone: "warm", exclude_keys: [] });
    result = r.data;
    if (!r.ok) return Response.json(result, { status: r.status });
  } else if (action.action_type === "request_refund") {
    const r = await call("sendLetter", { party, kind: "vendor", tone: "firm", exclude_keys: [] });
    result = r.data;
    if (!r.ok) return Response.json(result, { status: r.status });
  } else if (action.action_type === "dismiss") {
    const flags = await db.Flag.filter({ party });
    for (const f of flags.filter((x) => x.status === "open")) {
      await call("transitionFlag", { flag_id: f.id, to_status: "dismissed", reason: "Already handled" });
    }
    result = { dismissed: true };
    undoable = true;
  } else if (action.action_type === "pattern_fix") {
    const key = action.params?.pattern_key;
    const patterns = await db.Pattern.filter({ key });
    if (patterns[0]) await db.Pattern.update(patterns[0].id, { fix_logged: true, fix: action.params?.fix || patterns[0].fix });
    result = { logged: true, pattern_key: key };
    undoable = false;
  } else {
    return Response.json({ error: `Unknown action_type ${action.action_type}` }, { status: 400 });
  }

  const audit = await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "execute_action",
    entity_type: "SuggestedAction",
    entity_id: action_id,
    before: { status: action.status },
    after: { status: "done", result },
    created_at: new Date().toISOString(),
    reversible: undoable,
    undone: false,
  });
  await db.SuggestedAction.update(action_id, { status: "done", audit_event_id: audit.id });
  return Response.json({ result, audit_event_id: audit.id, undoable });
}
