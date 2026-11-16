// Copy and proof helpers for "Today's fixes" and "Proof · Trace".
// Every number comes from flag.evidence or flag.amount_cents; math lines are shown only when they reproduce the amount exactly.
import { RULES, fmt, toCents } from "@/lib/engine/engine.js";
import { SBS_LINEAGE_KEYS } from "@/components/SideBySide.jsx";

/** Plain card title per rule. */
export function fixTitle(flag) {
  const p = flag.party;
  switch (flag.rule_id) {
    case "dup_payment": return `${p} paid twice`;
    case "over_po": return `${p} billed over PO`;
    case "unbilled": return `${p} shipment never invoiced`;
    case "short_billed": return `${p} short-billed`;
    case "below_contract": return `${p} billed below contract`;
    case "above_contract": return `${p} billed above contract`;
    case "freight": return `${p} freight not rebilled`;
    case "overdue": return `${p} invoice overdue`;
    case "dup_credit_memo": return `${p} credited twice`;
    case "missing_credit": return `${p} credit never issued`;
    default: return flag.title || `${flag.rule || flag.rule_id}: ${p}`;
  }
}

/** Action button text per rule. */
export function fixActionLabel(flag) {
  const amt = fmt(flag.amount_cents || 0);
  if (flag.lane === "vendor") return flag.rule_id === "over_po" ? `Dispute ${amt}` : `Request refund ${amt}`;
  switch (flag.rule_id) {
    case "unbilled":
    case "short_billed": return `Draft invoice ${amt}`;
    case "below_contract": return `Bill difference ${amt}`;
    case "freight": return `Rebill freight ${amt}`;
    case "overdue": return `Send reminder ${amt}`;
    default: return `Draft fix ${amt}`;
  }
}

/** Pattern whose keys cover the most of `flagsInScope` (ties: more money). */
export function fixPatternFor(flagsInScope, patterns) {
  const keys = new Set(flagsInScope.map((f) => f.stable_key));
  let best = null;
  for (const p of patterns || []) {
    const hits = (p.keys || []).filter((k) => keys.has(k)).length;
    if (!hits) continue;
    if (!best || hits > best.hits || (hits === best.hits && (p.amount_cents || 0) > (best.p.amount_cents || 0))) best = { p, hits };
  }
  return best ? best.p : null;
}

/** Root-cause sentence for one flag: the pattern that includes it, else its rule name. */
export function fixRootCause(flag, seamFlags, patterns) {
  if (!flag) return "";
  const containing = (patterns || []).filter((p) => (p.keys || []).includes(flag.stable_key));
  const p = fixPatternFor(seamFlags, containing);
  return p ? p.title : flag.rule || flag.rule_id;
}

// ---------- records side by side ----------

const FIX_FIELD_LABELS = {
  invoice_no: "Vendor invoice",
  unit_price: "Unit price",
  price: "Contract price",
  po_amount: "PO amount",
  amount: "Amount",
  freight_cost: "Freight cost",
  freight_billed: "Freight billed",
  rebill_freight: "Rebill freight",
  qty: "Quantity",
  invoice: "Invoice",
  ship_date: "Ship date",
  paid: "Paid",
  date: "Date",
  sku: "SKU",
  order: "Order",
  from: "Price from",
  to: "Price to",
  credit_memo: "Credit memo",
  qty_returned: "Qty returned",
  billed_qty: "Billed qty",
};
const FIX_MONEY_KEYS = new Set(["unit_price", "price", "po_amount", "amount", "freight_cost", "freight_billed"]);
const FIX_PRIMARY_ORDER = [
  "price", "unit_price", "po_amount", "amount", "freight_cost", "freight_billed", "rebill_freight",
  "qty", "invoice_no", "invoice", "credit_memo", "qty_returned", "billed_qty",
];

export function fixFieldLabel(key) {
  return FIX_FIELD_LABELS[key] || String(key).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function fixFieldValue(key, value) {
  if (FIX_MONEY_KEYS.has(key) && /^-?[\d,]+(\.\d+)?$/.test(String(value ?? "").trim())) return fmt(toCents(value));
  return String(value ?? "");
}

function fixFieldMatchesDiff(diff, key) {
  if (!diff) return false;
  if (key === diff || String(key).startsWith(`${diff}_`)) return true;
  return diff === "qty" && String(key).includes("qty");
}

/**
 * Evidence records for the proof: business ID label, primary field, other fields, tint flag.
 * When several records hold the differing field, the first is the reference and the rest are tinted.
 */
export function fixRecords(flag) {
  const evidence = flag?.evidence || [];
  const rows = evidence.map((ev) => {
    const fields = Object.entries(ev.fields || {}).filter(([k]) => !SBS_LINEAGE_KEYS.has(k));
    const diffKey = fields.find(([k]) => fixFieldMatchesDiff(flag.diff_field, k))?.[0] || null;
    const primaryKey = diffKey || FIX_PRIMARY_ORDER.find((k) => fields.some(([fk]) => fk === k)) || fields[0]?.[0] || null;
    const hasId = ev.id && ev.id !== "—";
    return {
      system: ev.system,
      label: hasId ? `${ev.system} · ${ev.id}` : `${ev.system} · no record`,
      id: hasId ? ev.id : "",
      primary: primaryKey ? { key: primaryKey, label: fixFieldLabel(primaryKey), value: fixFieldValue(primaryKey, (ev.fields || {})[primaryKey]) } : null,
      others: fields
        .filter(([k]) => k !== primaryKey)
        .map(([k, v]) => ({ key: k, label: fixFieldLabel(k), value: fixFieldValue(k, v) })),
      fields,
      holdsDiff: Boolean(diffKey),
    };
  });
  const holders = rows.filter((r) => r.holdsDiff);
  for (const r of rows) r.tinted = r.holdsDiff && (holders.length === 1 || r !== holders[0]);
  return rows;
}

// ---------- math ----------

function fixEv(flag, system, key) {
  const ev = (flag.evidence || []).find((e) => e.system === system && e.fields && e.fields[key] != null);
  return ev ? ev.fields[key] : null;
}
function fixInt(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isInteger(n) ? n : null;
}

function fixMathCandidate(flag) {
  const has = (...vals) => vals.every((v) => v != null && v !== "");
  switch (flag.rule_id) {
    case "below_contract":
    case "above_contract": {
      const p = fixEv(flag, "CRM", "price"), u = fixEv(flag, "Billing", "unit_price"), q = fixInt(fixEv(flag, "Billing", "qty"));
      if (!has(p, u) || q == null) return null;
      const pc = toCents(p), uc = toCents(u);
      return flag.rule_id === "below_contract"
        ? { cents: q * (pc - uc), text: `${q} × (${fmt(pc)} contract − ${fmt(uc)} billed)` }
        : { cents: q * (uc - pc), text: `${q} × (${fmt(uc)} billed − ${fmt(pc)} contract)` };
    }
    case "unbilled": {
      const q = fixInt(fixEv(flag, "Warehouse", "qty")), p = fixEv(flag, "CRM", "price");
      if (q == null || !has(p)) return null;
      const pc = toCents(p);
      if (fixEv(flag, "CRM", "rebill_freight") === "Y") {
        const fc = toCents(fixEv(flag, "Warehouse", "freight_cost"));
        return { cents: q * pc + fc, text: `${q} × ${fmt(pc)} + ${fmt(fc)} freight` };
      }
      return { cents: q * pc, text: `${q} × ${fmt(pc)}` };
    }
    case "short_billed": {
      const shipped = fixInt(fixEv(flag, "Warehouse", "qty"));
      const billing = (flag.evidence || []).filter((e) => e.system === "Billing");
      const billed = billing.reduce((a, e) => a + (fixInt(e.fields?.qty) || 0), 0);
      const u = billing[0]?.fields?.unit_price;
      if (shipped == null || !has(u)) return null;
      const uc = toCents(u);
      return { cents: (shipped - billed) * uc, text: `(${shipped} shipped − ${billed} billed) × ${fmt(uc)}` };
    }
    case "freight": {
      const fc = fixEv(flag, "Warehouse", "freight_cost"), fb = fixEv(flag, "Billing", "freight_billed");
      if (!has(fc, fb)) return null;
      return { cents: toCents(fc) - toCents(fb), text: `${fmt(toCents(fc))} freight − ${fmt(toCents(fb))} billed` };
    }
    case "over_po": {
      const a = fixEv(flag, "AP", "amount"), po = fixEv(flag, "AP", "po_amount");
      if (!has(a, po)) return null;
      return { cents: toCents(a) - toCents(po), text: `${fmt(toCents(a))} paid − ${fmt(toCents(po))} PO` };
    }
    case "dup_payment":
    case "dup_credit_memo": {
      const ev = flag.evidence || [];
      const last = ev[ev.length - 1]?.fields?.amount;
      if (ev.length < 2 || !has(last)) return null;
      const c = toCents(last);
      return { cents: c, text: `${flag.rule_id === "dup_payment" ? "Paid" : "Credited"} twice: ${fmt(c)}`, bare: true };
    }
    case "overdue": {
      const q = fixInt(fixEv(flag, "Billing", "qty")), u = fixEv(flag, "Billing", "unit_price");
      if (q == null || !has(u)) return null;
      return { cents: q * toCents(u), text: `Open balance ${q} × ${fmt(toCents(u))}` };
    }
    default:
      return null;
  }
}

/** One line computing the amount from evidence, or the rule fallback when the fields can't reproduce it exactly. */
export function fixMathLine(flag) {
  if (!flag) return "";
  const c = fixMathCandidate(flag);
  if (c && c.cents === flag.amount_cents) return c.bare ? c.text : `${c.text} = ${fmt(c.cents)}`;
  return `Amount computed by rule ${flag.rule || flag.rule_id}`;
}

// ---------- ruled out ----------

const FIX_RULE_SEAM = new Map(Object.values(RULES).map((r) => [r.name, r.seam]));

/** One RuledOut row for this flag's seam, preferring the flag's own rule. */
export function fixRuledOutFor(flag, ruled) {
  if (!flag) return null;
  const inSeam = (ruled || []).filter((r) => FIX_RULE_SEAM.get(r.rule) === flag.seam);
  return inSeam.find((r) => r.rule === flag.rule) || inSeam[0] || null;
}

// ---------- evidence pack ----------

function fixCsvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV: one row per record field, with rule, party, amount and the math line repeated. */
export function fixEvidenceCsv(flag) {
  const head = ["rule", "party", "amount", "system", "record_id", "field", "value", "math"];
  const base = [flag.rule || flag.rule_id, flag.party, fmt(flag.amount_cents || 0)];
  const math = fixMathLine(flag);
  const lines = [head];
  for (const r of fixRecords(flag)) {
    for (const [k, v] of r.fields) lines.push([...base, r.system, r.id, k, v, math]);
  }
  return lines.map((row) => row.map(fixCsvCell).join(",")).join("\n") + "\n";
}

export function fixDownloadEvidence(flag) {
  const blob = new Blob([fixEvidenceCsv(flag)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = String(flag.party || "party").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  a.href = url;
  a.download = `evidence-${slug}-${flag.rule_id || "flag"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
