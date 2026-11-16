// Backend: sendLetter. Admin gate — rebuild, recompute total, four-eyes, freeze + SHA-256, flags → sent.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js"; // BASE44: import { createClientFromRequest } from "npm:@base44/sdk";
import {
  buildLetterDraft,
  DEFAULT_SETTINGS,
  fmt,
  sha256Hex,
  validateLetterAiText,
  letterToneGreeting,
  letterToneClosing,
} from "../src/lib/engine/engine.js";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const {
    party,
    kind = "customer",
    tone = "warm",
    exclude_keys = [],
    subject,
    total_cents: clientTotal,
  } = await req.json();
  if (!party) return Response.json({ error: "party required" }, { status: 400 });

  const db = base44.asServiceRole.entities;
  const [flags, contracts, settingRows] = await Promise.all([
    db.Flag.list(undefined, 5000),
    db.Contract.list(undefined, 5000),
    db.Setting.list(undefined, 10),
  ]);
  const s = settingRows[0] || {};
  const rule_enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(s.rule_enabled || {}) };
  const threshold = s.four_eyes_threshold_cents ?? DEFAULT_SETTINGS.four_eyes_threshold_cents ?? 500000;

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
    kind,
    tone,
    flags,
    contracts,
    exclude_keys,
    rule_enabled,
    greeting,
    closing,
    subject,
  });

  if (!draft.to) return Response.json({ error: "No recipient on file" }, { status: 400 });
  if (!draft.flag_keys.length) return Response.json({ error: "No open lines to send" }, { status: 409 });

  if (clientTotal != null && Number(clientTotal) !== draft.total_cents) {
    return Response.json({ error: "Total mismatch" }, { status: 409 });
  }

  for (const key of draft.flag_keys) {
    const rows = flags.filter((f) => f.stable_key === key);
    const f = rows[0];
    if (!f) return Response.json({ error: "Flag missing" }, { status: 409 });
    const okStatus = kind === "correction" ? f.status === "needs_review" : f.status === "open";
    if (!okStatus) {
      return Response.json({ error: "Included flag is not open" }, { status: 409 });
    }
  }

  if (Math.abs(draft.total_cents) >= threshold) {
    const action = await db.SuggestedAction.create({
      source: "flag",
      action_type: "send_letter",
      params: {
        party,
        kind,
        tone,
        exclude_keys,
        subject: subject || draft.subject,
        total_cents: draft.total_cents,
        requested_by: user.email,
      },
      label: `Send ${fmt(Math.abs(draft.total_cents))} ${kind} letter to ${party}?`,
      amount_cents: Math.abs(draft.total_cents),
      status: "pending_second",
    });
    await db.AuditEvent.create({
      actor_email: user.email,
      actor_role: user.role,
      action: "pending_second",
      entity_type: "SuggestedAction",
      entity_id: action.id,
      after: { party, kind, total_cents: draft.total_cents },
      created_at: new Date().toISOString(),
      reversible: false,
      undone: false,
    });
    return Response.json({ pending_second: action.id });
  }

  const body = draft.body;
  const recipient = draft.to;
  const total = draft.total_cents;
  const hash = await sha256Hex(body + String(total) + recipient);
  await base44.integrations.Core.SendEmail({
    to: recipient,
    subject: subject || draft.subject,
    body,
    from_name: "Northline Supply",
  });
  const letter = await db.Letter.create({
    party: draft.party,
    kind: draft.kind,
    tone: draft.tone,
    recipient,
    subject: subject || draft.subject,
    frozen_body: body,
    frozen_total_cents: total,
    flag_keys: draft.flag_keys,
    sha256: hash,
    sent_at: new Date().toISOString(),
    approver_emails: [user.email],
  });
  for (const key of draft.flag_keys) {
    const rows = await db.Flag.filter({ stable_key: key });
    for (const f of rows) {
      if (f.status === "open" || f.status === "needs_review") {
        await db.Flag.update(f.id, { status: "sent" });
      }
    }
  }
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
    },
    created_at: new Date().toISOString(),
    reversible: false,
    undone: false,
  });
  return Response.json({ letter_id: letter.id, sha256: hash });
}
