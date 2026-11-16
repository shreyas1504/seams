// Backend: buildLetter. Any user. Code writes lines/numbers; AI greeting/closing only (template fallback).
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import {
  buildLetterDraft,
  DEFAULT_SETTINGS,
  validateLetterAiText,
} from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { party, kind = "customer", tone = "warm", exclude_keys = [] } = await req.json();
  if (!party) return Response.json({ error: "party required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const [flags, contracts, settingRows] = await Promise.all([
    db.Flag.list(undefined, 5000),
    db.Contract.list(undefined, 5000),
    db.Setting.list(undefined, 10),
  ]);
  const s = settingRows[0] || {};
  const rule_enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(s.rule_enabled || {}) };

  let greeting, closing;
  try {
    const ai = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a short greeting and closing for a letter to ${party}. Tone: ${tone}. No digits, URLs, email addresses, or bank words.`,
      response_json_schema: {
        type: "object",
        properties: { greeting: { type: "string" }, closing: { type: "string" } },
      },
    });
    if (validateLetterAiText(ai?.greeting) && validateLetterAiText(ai?.closing)) {
      greeting = ai.greeting;
      closing = ai.closing;
    }
  } catch {
    /* deterministic templates */
  }

  const draft = buildLetterDraft({
    party,
    kind,
    tone,
    flags,
    contracts,
    exclude_keys,
    rule_enabled,
    greeting,
    closing,
  });
  return Response.json(draft);
}
