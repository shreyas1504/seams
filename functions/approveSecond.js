// Backend: approveSecond. Different admin completes a pending_second sendLetter.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import {
  buildLetterDraft,
  DEFAULT_SETTINGS,
  letterToneClosing,
  letterToneGreeting,
  sha256Hex,
  validateLetterAiText,
} from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { action_id } = await req.json();
  if (!action_id) return Response.json({ error: "action_id required" }, { status: 400 });
  const db = base44.asServiceRole.entities;
  const action = await db.SuggestedAction.get(action_id);
  if (!action || action.status !== "pending_second") {
    return Response.json({ error: "No pending second approval" }, { status: 404 });
  }
  const params = action.params || {};
  if (params.requested_by && params.requested_by === user.email) {
    return Response.json({ error: "A different Controller must approve" }, { status: 403 });
  }

  const [flags, contracts, settingRows] = await Promise.all([
    db.Flag.list(undefined, 5000),
    db.Contract.list(undefined, 5000),
    db.Setting.list(undefined, 10),
  ]);
  const s = settingRows[0] || {};
  const rule_enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(s.rule_enabled || {}) };
  const tone = params.tone || "warm";
  const party = params.party;
  let greeting = letterToneGreeting(party, tone);
  let closing = letterToneClosing(tone);
  try {
    const ai = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a short greeting and closing for a letter to ${party}. Tone: ${tone}.`,
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
    /* templates */
  }

  const draft = buildLetterDraft({
    party,
    kind: params.kind || "vendor",
    tone,
    flags,
    contracts,
    exclude_keys: params.exclude_keys || [],
    rule_enabled,
    greeting,
    closing,
    subject: params.subject,
  });
  if (!draft.to || !draft.flag_keys.length) {
    return Response.json({ error: "Letter can no longer be sent" }, { status: 409 });
  }
  if (params.total_cents != null && Number(params.total_cents) !== draft.total_cents) {
    return Response.json({ error: "Total mismatch" }, { status: 409 });
  }
  for (const key of draft.flag_keys) {
    const f = flags.find((x) => x.stable_key === key);
    if (!f || f.status !== "open") {
      return Response.json({ error: "Included flag is not open" }, { status: 409 });
    }
  }

  const body = draft.body;
  const recipient = draft.to;
  const total = draft.total_cents;
  const hash = await sha256Hex(body + String(total) + recipient);
  await base44.integrations.Core.SendEmail({
    to: recipient,
    subject: params.subject || draft.subject,
    body,
    from_name: "Northline Supply",
  });
  const letter = await db.Letter.create({
    party: draft.party,
    kind: draft.kind,
    tone: draft.tone,
    recipient,
    subject: params.subject || draft.subject,
    frozen_body: body,
    frozen_total_cents: total,
    flag_keys: draft.flag_keys,
    sha256: hash,
    sent_at: new Date().toISOString(),
    approver_emails: [params.requested_by, user.email].filter(Boolean),
  });
  for (const key of draft.flag_keys) {
    const rows = await db.Flag.filter({ stable_key: key });
    for (const f of rows) {
      if (f.status === "open") await db.Flag.update(f.id, { status: "sent" });
    }
  }
  await db.SuggestedAction.update(action_id, { status: "done", audit_event_id: letter.id });
  await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: "send_letter",
    entity_type: "Letter",
    entity_id: letter.id,
    after: {
      sha256: hash,
      flag_keys: draft.flag_keys,
      total_cents: total,
      recipient,
      party: draft.party,
      kind: draft.kind,
      second_approver: user.email,
    },
    created_at: new Date().toISOString(),
    reversible: false,
    undone: false,
  });
  return Response.json({ letter_id: letter.id, sha256: hash });
}
