// Backend: recordVisit. Any user. Returns deltas since this user's last visit AuditEvent.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import { visitDeltasSince } from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = base44.asServiceRole.entities;
  const events = await db.AuditEvent.list("-created_at", 5000);
  const myVisits = events.filter((e) => e.action === "visit" && e.actor_email === user.email);
  const last = myVisits[0];
  const last_seen_at = last?.created_at || null;
  const afterLast = last_seen_at
    ? events.filter((e) => Date.parse(e.created_at || e.created_date || 0) > Date.parse(last_seen_at))
    : events;
  const since = visitDeltasSince(afterLast, null);
  await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "visit",
    entity_type: "User",
    created_at: new Date().toISOString(),
    reversible: false,
    undone: false,
  });
  return Response.json({ since, last_seen_at });
}
