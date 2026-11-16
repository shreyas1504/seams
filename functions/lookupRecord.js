// Backend: lookupRecord. Any signed-in user. Matches flag/ruled-out ids (case-insensitive, digits-only for orders).
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import { resolveLookup } from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id || !String(id).trim()) return Response.json({ error: "id required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const [flags, ruled] = await Promise.all([
    db.Flag.list(undefined, 5000),
    db.RuledOut.list(undefined, 5000),
  ]);
  const result = resolveLookup(id, flags, ruled);
  return Response.json(result);
}
