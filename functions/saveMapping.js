// Backend: saveMapping. Controller only. Upsert ColumnMapping by header_hash.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { header_hash, target_entity, column_map, date_format } = await req.json();
  if (!header_hash || !target_entity || !Array.isArray(column_map)) {
    return Response.json({ error: "header_hash, target_entity, column_map required" }, { status: 400 });
  }
  const db = base44.asServiceRole.entities;
  const existing = await db.ColumnMapping.filter({ header_hash });
  let row;
  if (existing[0]) {
    row = await db.ColumnMapping.update(existing[0].id, {
      target_entity,
      column_map,
      date_format: date_format || existing[0].date_format || "MDY",
    });
  } else {
    row = await db.ColumnMapping.create({
      header_hash,
      target_entity,
      column_map,
      date_format: date_format || "MDY",
    });
  }
  await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "save_mapping",
    entity_type: "ColumnMapping",
    entity_id: row.id,
    after: { header_hash, target_entity, date_format: row.date_format },
    created_at: new Date().toISOString(),
    reversible: true,
    undone: false,
  });
  return Response.json({ id: row.id });
}
