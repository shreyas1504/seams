// Kit mode: the app loads ONLY the two files our code writes (findings.csv -> Finding, evidence.csv -> Evidence)
// plus Decisions made in the app. This module turns those rows into the finding shape the Seams screens use.
// No amounts are computed here: every dollar comes from findings.csv, so app totals always match the file.
import { useMemo } from "react";
import { useEntity } from "@/lib/useEntity";
import { toCents } from "@/lib/engine/engine.js";

const KIT_FILE_SYSTEM = {
  "delivery_log.csv": "Warehouse",
  "invoices.csv": "Billing",
  "products.csv": "Price list",
  "contract_prices.csv": "CRM",
  "customers.csv": "CRM",
  "purchase_orders.csv": "Purchasing",
  "supplier_bills.csv": "AP",
  "suppliers.csv": "AP",
  "inbox.csv": "Inbox",
};
export const KIT_ID_FIELDS = ["delivery_id", "invoice_no", "sku", "po_no", "bill_id", "supplier", "message_id"];

export function kitSlug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** One Finding row (+ its Evidence and latest Decision) -> the finding object the screens render. */
export function kitToFlag(f, evidence, decision) {
  const amount = Number(f.amount) || 0;
  const cents = toCents(String(Math.abs(amount)));
  const vendor = Boolean(f.bill_id || f.po_no || f.supplier) || /AP|Vendor/.test(f.category || "");
  const status = decision?.status === "approved" ? "sent" : decision?.status === "dismissed" ? "dismissed" : "open";
  return {
    id: f.id,
    kit: true,
    stable_key: f.finding_id,
    finding_id: f.finding_id,
    rule_id: kitSlug(f.problem),
    rule: f.problem,
    title: f.party ? `${f.party}: ${f.problem.charAt(0).toLowerCase()}${f.problem.slice(1)}` : f.problem,
    why: f.explanation || f.cause || "",
    cause: f.cause || f.problem,
    month: f.month || "",
    date: f.date || "",
    seam: f.category || "Other",
    bucket: amount > 0 ? "recoverable" : amount < 0 ? "credit_owed" : "attention",
    lane: vendor ? "vendor" : "customer",
    party: f.party || f.supplier || "",
    amount_cents: cents,
    signed_cents: amount < 0 ? -cents : cents,
    action_type: f.action_type || "",
    status,
    decision: decision || null,
    ids: KIT_ID_FIELDS.map((k) => f[k]).filter(Boolean),
    idFields: Object.fromEntries(KIT_ID_FIELDS.filter((k) => f[k]).map((k) => [k, f[k]])),
    evidence: (evidence || []).map((e) => ({
      system: KIT_FILE_SYSTEM[e.file] || e.file,
      id: e.record,
      file: e.file,
      fields: { shows: e.shows, ...(e.expected ? { expected: e.expected } : {}) },
    })),
    created_date: f.created_date,
  };
}

/** Findings + Evidence + Decisions, joined by finding_id. Returns [flags, reload, meta, extras]. */
export function useKitFlags() {
  const [findings, reloadF, metaF] = useEntity("Finding");
  const [evidence] = useEntity("Evidence");
  const [decisions] = useEntity("Decision");
  const flags = useMemo(() => {
    const ev = new Map();
    for (const e of evidence) {
      if (!ev.has(e.finding_id)) ev.set(e.finding_id, []);
      ev.get(e.finding_id).push(e);
    }
    const dec = new Map();
    for (const d of [...decisions].sort((a, b) => String(a.decided_at || "").localeCompare(String(b.decided_at || "")))) dec.set(d.finding_id, d);
    return findings.map((f) => kitToFlag(f, ev.get(f.finding_id), dec.get(f.finding_id)));
  }, [findings, evidence, decisions]);
  return [flags, reloadF, metaF, { findings, decisions }];
}

/** Causes as "patterns" (keys = finding_ids) so cause tags and the seam summary group by cause. */
export function kitCausePatterns(flags) {
  const by = new Map();
  for (const f of flags) {
    if (!by.has(f.cause)) by.set(f.cause, { key: `cause:${f.cause}`, title: f.cause, keys: [] });
    by.get(f.cause).keys.push(f.stable_key);
  }
  return [...by.values()];
}

/** Totals by month straight from the file (net of negatives), so judges can match them to findings.csv. */
export function kitMonthTotals(flags) {
  const out = new Map();
  for (const f of flags) {
    const m = f.month || "unknown";
    const t = out.get(m) || { month: m, rows: 0, cents: 0 };
    t.rows += 1;
    t.cents += f.signed_cents;
    out.set(m, t);
  }
  return [...out.values()];
}

/** What changed: a cause with only October rows is new, both months is still open, only September is fixed. */
export function kitWhatChanged(flags) {
  const months = new Map();
  for (const f of flags) {
    if (!months.has(f.cause)) months.set(f.cause, new Set());
    months.get(f.cause).add(f.month);
  }
  const res = { new: [], open: [], fixed: [], hasOctober: false };
  for (const [cause, set] of months) {
    if (set.has("october")) res.hasOctober = true;
    if (set.has("october") && !set.has("september")) res.new.push(cause);
    else if (set.has("october") && set.has("september")) res.open.push(cause);
    else if (set.has("september")) res.fixed.push(cause);
  }
  return res;
}

/**
 * Ask Seams over the loaded findings (no backend needed). Code answers from findings.csv rows; returns
 * { answer, ids, refused }. Optional Base44 AI only rephrases unusual questions into one of these intents.
 */
export function kitAsk(question, flags) {
  const q = String(question || "").toLowerCase();
  const open = flags.filter((f) => f.status === "open");
  const money = (c) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sum = (fs) => fs.reduce((a, f) => a + f.signed_cents, 0);
  const idsOf = (fs) => [...new Set(fs.flatMap((f) => f.ids))].slice(0, 12);
  if (!q.trim()) return null;
  if (/forecast|predict|next (quarter|year)/.test(q)) return { answer: "I only answer from the findings our code produced.", ids: [], refused: true };
  const byCause = new Map();
  for (const f of open) byCause.set(f.cause, [...(byCause.get(f.cause) || []), f]);
  const parties = [...new Set(open.map((f) => f.party).filter(Boolean))];
  const party = parties.find((p) => p.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => q.includes(w)));
  const id = (q.match(/\b(d-\d{6}-\d{4}|\d{7}|b-\d{5}|po-?\d{5}|m-\d{6}|nl-\d{5}|sup-\d{3})\b/i) || [])[1];
  if (id) {
    const hit = flags.filter((f) => f.ids.some((x) => x.toLowerCase() === id.toLowerCase()));
    if (!hit.length) return { answer: `${id.toUpperCase()} is not in any finding: it checked out.`, ids: [] };
    return { answer: hit.slice(0, 4).map((f) => `${f.rule}: ${money(f.signed_cents)} (${f.cause})`).join("; "), ids: idsOf(hit), flag: hit[0] };
  }
  if (party) {
    const fs = open.filter((f) => f.party === party);
    const causes = [...new Set(fs.map((f) => f.cause))];
    return { answer: `${party}: ${fs.length} open finding${fs.length === 1 ? "" : "s"}, ${money(sum(fs))} net. Causes: ${causes.slice(0, 3).join("; ")}.`, ids: idsOf(fs) };
  }
  if (/email|reply|answer|inbox/.test(q)) {
    const fs = open.filter((f) => /email/i.test(f.rule));
    return { answer: `${fs.length} customer emails still need a reply.`, ids: idsOf(fs) };
  }
  if (/bank|fraud|phish|fake/.test(q)) {
    const fs = open.filter((f) => /bank/i.test(f.rule));
    return { answer: fs.length ? `${fs.length} bank-detail problems: ${fs.map((f) => f.ids.join(" ")).join("; ")}. Hold payment and call the number on file.` : "No bank-detail problems open.", ids: idsOf(fs) };
  }
  if (/owe (them|customers?)|credit|refund|overbill/.test(q)) {
    const fs = open.filter((f) => f.signed_cents < 0);
    return { answer: `We owe customers ${money(-sum(fs))} across ${fs.length} lines.`, ids: idsOf(fs) };
  }
  if (/supplier|vendor|po\b|bill/.test(q)) {
    const fs = open.filter((f) => f.lane === "vendor");
    return { answer: `Suppliers: ${fs.length} open lines, ${money(sum(fs))} to recover or hold.`, ids: idsOf(fs) };
  }
  if (/top|biggest|largest|first|priority|chase|worst/.test(q) || /cause|why/.test(q)) {
    const top = [...byCause.entries()].sort((a, b) => Math.abs(sum(b[1])) - Math.abs(sum(a[1]))).slice(0, 3);
    return { answer: top.map(([c, fs], i) => `${i + 1}. ${c}: ${fs.length} lines, ${money(sum(fs))}`).join("; "), ids: idsOf(top.flatMap((t) => t[1])) };
  }
  const type = [...new Set(open.map((f) => f.rule))].find((r) => r.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => q.includes(w)));
  if (type) {
    const fs = open.filter((f) => f.rule === type);
    return { answer: `${type}: ${fs.length} open lines, ${money(sum(fs))}.`, ids: idsOf(fs) };
  }
  if (/lose|lost|leak|total|how much|summary|today|month/.test(q)) {
    const rec = open.filter((f) => f.signed_cents > 0);
    return { answer: `${money(sum(rec))} to recover across ${rec.length} lines; we owe customers ${money(-sum(open.filter((f) => f.signed_cents < 0)))}; ${byCause.size} causes open.`, ids: [] };
  }
  return { answer: "I can answer from the findings: try a customer name, a record ID, 'biggest causes', 'what do we owe customers' or 'emails needing a reply'.", ids: [], refused: true };
}
