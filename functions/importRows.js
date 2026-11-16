// Backend function: importRows. Controller only. Rows are parsed in code on the client (never AI extraction),
// mapped to canonical fields, then stored with lineage (import_batch_id, source_row).
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
const ALLOWED = ["Contract", "Shipment", "Invoice", "VendorBill", "Return"];

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { entity, rows, header_hash, file_name } = await req.json();
  if (!ALLOWED.includes(entity)) return Response.json({ error: `Unknown entity ${entity}` }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const batch = `${entity}-${Date.now()}`;
  const tagged = rows.map((r, i) => ({ ...r, import_batch_id: batch, source_row: i + 2 }));
  for (let i = 0; i < tagged.length; i += 500) await db[entity].bulkCreate(tagged.slice(i, i + 500));
  await db.AuditEvent.create({ actor_email: user.email, actor_role: user.role, action: "import", entity_type: entity,
    after: { file_name, header_hash, rows: rows.length, batch }, import_batch_id: batch, created_at: new Date().toISOString() });
  return Response.json({ ok: true, entity, imported: rows.length, batch });
}
