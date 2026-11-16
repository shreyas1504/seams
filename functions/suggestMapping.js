// Backend: suggestMapping. Analyst+. InvokeLLM with schema, then fuzzy fallback. Never imports.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js";
import { ENTITY_CANONICAL_FIELDS, fuzzyMapHeaders, guessTargetEntity } from "../src/lib/mapping.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { headers, sample_rows } = await req.json();
  if (!Array.isArray(headers) || !headers.length) {
    return Response.json({ error: "headers required" }, { status: 400 });
  }
  const schema = {
    type: "object",
    properties: {
      target_entity: { type: "string" },
      column_map: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source_col: { type: "string" },
            maps_to: { type: "string" },
            confidence: { type: "number" },
          },
        },
      },
    },
  };
  try {
    const ai = await base44.integrations.Core.InvokeLLM({
      prompt: `Map these CSV headers to one of ${Object.keys(ENTITY_CANONICAL_FIELDS).join(", ")} and their canonical fields. Headers: ${JSON.stringify(headers)}. Sample: ${JSON.stringify((sample_rows || []).slice(0, 3))}`,
      response_json_schema: schema,
    });
    if (ai?.target_entity && Array.isArray(ai.column_map)) {
      return Response.json({ ...ai, source: "ai" });
    }
  } catch (_) {
    // fall through to fuzzy
  }
  const target_entity = guessTargetEntity(headers);
  const column_map = fuzzyMapHeaders(headers, target_entity);
  return Response.json({ target_entity, column_map, source: "fuzzy" });
}
