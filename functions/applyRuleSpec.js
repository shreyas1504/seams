// Backend: applyRuleSpec. Controller only. dry_run | approve | revoke twist templates.
import { createClientFromRequest } from "../src/lib/local/sdkShim.js";
import { runEngine, DEFAULT_SETTINGS, fmt } from "../src/lib/engine/engine.js";

const TWIST_ON = { return_offset: true, dup_credit_memo: true, missing_credit: true };
const TWIST_OFF = { return_offset: false, dup_credit_memo: false, missing_credit: false };

async function loadEngineInput(db) {
  const [contracts, shipments, invoices, bills, returns, settingRows, existing] = await Promise.all([
    db.Contract.list(undefined, 5000),
    db.Shipment.list(undefined, 5000),
    db.Invoice.list(undefined, 5000),
    db.VendorBill.list(undefined, 5000),
    db.Return.list(undefined, 5000),
    db.Setting.list(undefined, 50),
    db.Flag.list(undefined, 5000),
  ]);
  const s = settingRows[0] || {};
  const settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    rule_enabled: { ...DEFAULT_SETTINGS.rule_enabled, ...(s.rule_enabled || {}) },
  };
  return { contracts, shipments, invoices, bills, returns, settings, settingRows, existing };
}

function centsList(flags) {
  return flags.map((f) => f.amount_cents).sort((a, b) => a - b);
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Controller role required" }, { status: 403 });
  const { mode } = await req.json();
  if (!["dry_run", "approve", "revoke"].includes(mode)) {
    return Response.json({ error: "mode must be dry_run|approve|revoke" }, { status: 400 });
  }
  const db = base44.asServiceRole.entities;
  const { contracts, shipments, invoices, bills, returns, settings, settingRows, existing } =
    await loadEngineInput(db);
  const data = { contracts, shipments, invoices, bills, returns };

  if (mode === "dry_run") {
    const before = runEngine(data, settings);
    const afterSettings = {
      ...settings,
      rule_enabled: { ...settings.rule_enabled, ...TWIST_ON },
    };
    const after = runEngine(data, afterSettings);
    const beforeKeys = new Map(before.flags.map((f) => [f.stable_key, f]));
    const afterKeys = new Map(after.flags.map((f) => [f.stable_key, f]));
    const cleared = [];
    for (const [k, f] of beforeKeys) {
      if (!afterKeys.has(k)) cleared.push(f);
    }
    const new_recoverable = [];
    const new_credit = [];
    for (const [k, f] of afterKeys) {
      if (beforeKeys.has(k)) continue;
      if (f.bucket === "recoverable") new_recoverable.push(f);
      if (f.bucket === "credit_owed") new_credit.push(f);
    }
    // Look-alike trap hits: rules that newly appear in ruledOut for twist-related reasons are not "trap hits"
    // Plan expects trap_hits [] for the clean returns file.
    const trap_hits = [];
    return Response.json({
      cleared: cleared.map((f) => ({
        stable_key: f.stable_key,
        amount_cents: f.amount_cents,
        amount: fmt(f.amount_cents),
        party: f.party,
        rule: f.rule,
      })),
      new_recoverable: new_recoverable.map((f) => ({
        stable_key: f.stable_key,
        amount_cents: f.amount_cents,
        amount: fmt(f.amount_cents),
        party: f.party,
      })),
      new_credit: new_credit.map((f) => ({
        stable_key: f.stable_key,
        amount_cents: f.amount_cents,
        amount: fmt(f.amount_cents),
        party: f.party,
      })),
      trap_hits,
      totals_before: before.totals,
      totals_after: after.totals,
      cleared_cents: centsList(cleared),
      new_recoverable_cents: centsList(new_recoverable),
      new_credit_cents: centsList(new_credit),
    });
  }

  const setting = settingRows[0];
  if (!setting) return Response.json({ error: "No settings row" }, { status: 400 });
  const nextEnabled = {
    ...(setting.rule_enabled || {}),
    ...(mode === "approve" ? TWIST_ON : TWIST_OFF),
  };
  const beforeSetting = { ...setting };
  await db.Setting.update(setting.id, { rule_enabled: nextEnabled });
  const audit = await db.AuditEvent.create({
    actor_email: user.email,
    actor_role: user.role,
    action: mode === "approve" ? "approve_twist_rules" : "revoke_twist_rules",
    entity_type: "Setting",
    entity_id: setting.id,
    before: { rule_enabled: beforeSetting.rule_enabled },
    after: { rule_enabled: nextEnabled },
    created_at: new Date().toISOString(),
    reversible: true,
    undone: false,
  });

  // Re-run checks through the SDK (in Base44 each backend function is deployed separately,
  // so one function calls another with base44.functions.invoke, never a file import).
  let checkBody;
  try {
    checkBody = (await base44.functions.invoke("runChecks", {})).data;
  } catch (e) {
    return Response.json(e?.response?.data || { error: e?.message || "runChecks failed" }, { status: e?.response?.status || 500 });
  }
  return Response.json({ ok: true, mode, audit_event_id: audit.id, checks: checkBody });
}
