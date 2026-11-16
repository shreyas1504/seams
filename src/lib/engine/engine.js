// Seams detection engine — plain JavaScript (ES module), no dependencies.
// Runs unchanged in: the local Vite app, Node tests, a Base44 page, and a Base44 backend function (Deno).
// Source of truth for numbers: tools/data/reference_checks.py. If they disagree, fix this file.

/** @typedef {{system:string,id:string,fields:Object<string,string>}} Evidence */
/** @typedef {{stable_key:string, rule:string, rule_id:string, title:string, why:string, seam:string,
 *  bucket:'recoverable'|'overdue'|'credit_owed', lane:'customer'|'vendor', party:string,
 *  amount_cents:number, confidence:'High'|'Medium', evidence:Evidence[], diff_field?:string, ids:string[]}} Flag */

export const DEFAULT_SETTINGS = {
  as_of_date: "2026-11-13",
  overdue_days: 30,
  po_abs_cents: 2500,
  po_pct: 0.01,
  match_window_days: 10,
  four_eyes_threshold_cents: 500000,
  rule_enabled: {
    unbilled: true, short_billed: true, below_contract: true, freight: true,
    dup_payment: true, over_po: true, overdue: true, above_contract: true,
    // twist templates: off until Dana approves them in the Twist card
    return_offset: false, dup_credit_memo: false, missing_credit: false,
  },
};

const RULES = {
  unbilled:        { name: "Shipped, not invoiced",        seam: "Warehouse→Billing",  bucket: "recoverable" },
  short_billed:    { name: "Short-billed",                 seam: "Warehouse→Billing",  bucket: "recoverable" },
  below_contract:  { name: "Below contract price",         seam: "CRM→Billing",        bucket: "recoverable" },
  freight:         { name: "Freight not rebilled",         seam: "Warehouse→Billing",  bucket: "recoverable" },
  dup_payment:     { name: "Duplicate vendor payment",     seam: "AP→Vendors",         bucket: "recoverable" },
  over_po:         { name: "Vendor over PO",               seam: "AP→Vendors",         bucket: "recoverable" },
  overdue:         { name: "Overdue receivable",           seam: "Billing→Cash",       bucket: "overdue" },
  above_contract:  { name: "Billed above contract",        seam: "CRM→Billing",        bucket: "credit_owed" },
  dup_credit_memo: { name: "Duplicate credit memo",        seam: "Returns→Billing",    bucket: "recoverable" },
  missing_credit:  { name: "Credit never issued",          seam: "Returns→Billing",    bucket: "credit_owed" },
};
export { RULES };

// ---------- normalization ----------
export const digits = (s) => String(s ?? "").replace(/\D/g, "");
export const keynorm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const EXPAND = { hosp: "hospital", grp: "group", mfg: "manufacturing", constr: "construction" };
const DROP = new Set(["inc", "llc", "corp", "group"]);
export function normName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => EXPAND[w] ?? w).filter((w) => !DROP.has(w)).join(" ");
}
/** "12.34" -> 1234 (integer cents, no float drift) */
export function toCents(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = s.startsWith("-");
  const [w, f = ""] = s.replace(/^-/, "").replace(/[$,]/g, "").split(".");
  const c = parseInt(w || "0", 10) * 100 + parseInt((f + "00").slice(0, 2), 10);
  return neg ? -c : c;
}
export const fmt = (c) => (c < 0 ? "-" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (c) => (Math.abs(c) / 100).toFixed(2);
/** Accepts ISO (2026-09-15) or US (09/15/2026). Returns a UTC day number. */
export function dayNum(s) {
  const t = String(s ?? "").trim();
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) [y, m, d] = t.slice(0, 10).split("-").map(Number);
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) { const p = t.split("/").map(Number); [m, d, y] = p; }
  else throw new Error(`Unrecognized date: ${t}`);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
/** Attach import lineage to evidence fields when the source row has it (amounts/keys unchanged). */
const evFields = (row, fields) => {
  const f = { ...fields };
  if (row?.import_batch_id) f.import_batch = row.import_batch_id;
  if (row?.source_row != null && row.source_row !== "") f.source_row = String(row.source_row);
  return f;
};

// ---------- main ----------
/**
 * @param {{contracts:any[], shipments:any[], invoices:any[], bills:any[], returns?:any[]}} data  canonical-field rows (strings ok)
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {{flags:Flag[], ruledOut:{rule:string,reason:string,ids:string[]}[], patterns:any[], needsReview:any[], totals:any}}
 */
export function runEngine(data, settings = DEFAULT_SETTINGS) {
  const S = { ...DEFAULT_SETTINGS, ...settings, rule_enabled: { ...DEFAULT_SETTINGS.rule_enabled, ...(settings.rule_enabled || {}) } };
  const on = (r) => S.rule_enabled[r] !== false;
  const asOf = dayNum(S.as_of_date);
  const contracts = data.contracts || [], ships = data.shipments || [], invs = data.invoices || [];
  const bills = data.bills || [], returns = data.returns || [];
  const flags = [], ruledOut = [], needsReview = [];

  const flag = (rule_id, ids, party, cents, why, evidence, extra = {}) => {
    const R = RULES[rule_id];
    const sorted = [...ids].sort();
    flags.push({
      stable_key: `${rule_id}|${sorted.join(",")}`, rule_id, rule: R.name, title: `${R.name}: ${party}`,
      why, seam: R.seam, bucket: R.bucket, lane: extra.lane || "customer", party,
      amount_cents: cents, confidence: extra.confidence || "High", evidence, diff_field: extra.diff_field, ids: sorted,
    });
  };
  const rule = (r, reason, ids = []) => ruledOut.push({ rule: r, reason, ids });

  // customers
  const crmByNorm = new Map(contracts.map((c) => [normName(c.customer_name), c.customer_name]));
  const resolve = (name) => crmByNorm.get(normName(name));
  const contractFor = (cust, sku, day) =>
    contracts.find((c) => c.customer_name === cust && c.sku === sku && dayNum(c.start_date) <= day && day <= dayNum(c.end_date));

  // join shipments <-> invoices
  const shipRows = ships.map((s) => ({ ...s, cust: resolve(s.ship_to) }));
  for (const s of shipRows) if (!s.cust) needsReview.push({ type: "unmatched_customer", id: s.shipment_id, name: s.ship_to });
  const invByOrder = new Map();
  const push = (k, i) => { if (!invByOrder.has(k)) invByOrder.set(k, []); invByOrder.get(k).push(i); };
  const noref = [];
  for (const i of invs) (digits(i.order_ref) ? push(digits(i.order_ref), i) : noref.push(i));
  for (const i of noref) {
    const c = shipRows.filter((s) => s.cust === i.customer && s.sku === i.sku && +s.qty === +i.qty && s.ship_type === "standard"
      && Math.abs(dayNum(i.invoice_date) - dayNum(s.ship_date)) <= S.match_window_days);
    if (c.length === 1) {
      push(digits(c[0].order_no), { ...i, _matched: "Medium" });
      rule("Shipped, not invoiced", `${i.invoice_no} has a blank order ref but matches ${c[0].shipment_id} on customer, SKU, qty and date`, [i.invoice_no, c[0].shipment_id]);
    } else needsReview.push({ type: "blank_ref_not_unique", id: i.invoice_no, candidates: c.map((x) => x.shipment_id) });
  }
  for (const s of shipRows) for (const i of invByOrder.get(digits(s.order_no)) || [])
    if (i.order_ref && i.order_ref.trim().toLowerCase().startsWith("so "))
      rule("Join", `${i.invoice_no} order ref '${i.order_ref}' matches ${s.order_no} (digits-only match)`, [i.invoice_no, s.order_no]);
  const variants = [...new Set(shipRows.filter((s) => s.cust && s.ship_to !== s.cust).map((s) => s.ship_to))].sort();
  if (variants.length) rule("Join", `Warehouse names ${variants.join(", ")} resolve to CRM customers (normalized full name)`, variants);

  // returns (deduped by return_id)
  const returned = new Map(); const seenRet = new Set();
  for (const r of returns) {
    if (seenRet.has(r.return_id)) continue; seenRet.add(r.return_id);
    const k = `${digits(r.order_ref)}|${r.sku}`; returned.set(k, (returned.get(k) || 0) + (+r.qty_returned));
  }
  const useReturns = on("return_offset");

  // shipment-side rules
  for (const s of shipRows) {
    if (!s.cust) continue;
    const day = dayNum(s.ship_date), c = contractFor(s.cust, s.sku, day);
    if (!c) { needsReview.push({ type: "no_contract", id: s.shipment_id }); continue; }
    const price = toCents(c.contract_price), rebill = c.rebill_freight === "Y", fc = toCents(s.freight_cost), qty = +s.qty;
    const shipEv = { system: "Warehouse", id: s.shipment_id, fields: evFields(s, { order: s.order_no, sku: s.sku, qty: String(qty), ship_date: s.ship_date, freight_cost: money(fc) }) };
    if (s.ship_type !== "standard") { rule("Shipped, not invoiced", `${s.shipment_id} is a ${s.ship_type} shipment, not billable`, [s.shipment_id]); continue; }
    const linv = invByOrder.get(digits(s.order_no)) || [];
    if (!linv.length) {
      if (on("unbilled")) {
        const amt = qty * price + (rebill ? fc : 0);
        flag("unbilled", [s.shipment_id], s.cust, amt,
          `Warehouse shipped ${qty} ${s.sku} on ${s.ship_date} (${s.shipment_id}). Billing has no invoice for order ${s.order_no}. ${qty} × $${money(price)}${rebill ? ` + freight $${money(fc)}` : ""} = $${money(amt)} unbilled.`,
          [shipEv, { system: "Billing", id: "—", fields: { invoice: "none found" } }, { system: "CRM", id: c.contract_id, fields: evFields(c, { price: money(price), rebill_freight: c.rebill_freight }) }],
          { diff_field: "invoice" });
      }
      continue;
    }
    const billedQ = linv.reduce((a, i) => a + +i.qty, 0);
    if (linv.length > 1 && billedQ === qty)
      rule("Short-billed", `${s.order_no} invoiced in ${linv.length} parts (${linv.map((i) => i.qty).join("+")}) = ${qty}`, linv.map((i) => i.invoice_no));
    const ret = useReturns ? returned.get(`${digits(s.order_no)}|${s.sku}`) || 0 : 0;
    if (billedQ < qty - ret) {
      if (on("short_billed")) {
        const miss = qty - ret - billedQ, amt = miss * price;
        flag("short_billed", [s.shipment_id, ...linv.map((i) => i.invoice_no)], s.cust, amt,
          `Warehouse shipped ${qty} (${s.shipment_id})${ret ? `, ${ret} returned` : ""}; invoice ${linv.map((i) => i.invoice_no).join(" + ")} bills ${billedQ}: ${miss} × $${money(price)} = $${money(amt)} missing.`,
          [shipEv, ...linv.map((i) => ({ system: "Billing", id: i.invoice_no, fields: evFields(i, { qty: i.qty, unit_price: i.unit_price, date: i.invoice_date }) }))],
          { diff_field: "qty" });
      }
    } else if (ret && billedQ === qty - ret) {
      rule("Short-billed", `${s.order_no}: ${ret} units returned explain the gap (cleared by twist)`, [s.order_no]);
    }
    const fb = linv.reduce((a, i) => a + toCents(i.freight_billed), 0);
    if (rebill && fc - fb > 0) {
      if (on("freight")) flag("freight", [s.shipment_id, linv[0].invoice_no], s.cust, fc - fb,
        `Contract ${c.contract_id} says rebill freight. Carrier cost $${money(fc)} (${s.shipment_id}); invoice ${linv[0].invoice_no} billed $${money(fb)}: $${money(fc - fb)} not passed on.`,
        [shipEv, { system: "Billing", id: linv[0].invoice_no, fields: evFields(linv[0], { freight_billed: money(fb) }) }, { system: "CRM", id: c.contract_id, fields: evFields(c, { rebill_freight: "Y" }) }],
        { diff_field: "freight" });
    }
    if (!rebill && fc > 0)
      rule("Freight not rebilled", `${s.shipment_id} freight ${money(fc)} not billed, but ${s.cust} contract does not rebill freight`, [s.shipment_id]);
  }

  // invoice-side rules
  for (const i of invs) {
    const idt = dayNum(i.invoice_date), c = contractFor(i.customer, i.sku, idt);
    if (!c) { needsReview.push({ type: "no_contract", id: i.invoice_no }); continue; }
    const cp = toCents(c.contract_price), up = toCents(i.unit_price), q = +i.qty;
    const invEv = { system: "Billing", id: i.invoice_no, fields: evFields(i, { date: i.invoice_date, sku: i.sku, qty: String(q), unit_price: money(up) }) };
    const ctEv = { system: "CRM", id: c.contract_id, fields: evFields(c, { price: money(cp), from: c.start_date, to: c.end_date }) };
    if (up < cp) {
      if (on("below_contract")) flag("below_contract", [i.invoice_no, c.contract_id], i.customer, (cp - up) * q,
        `Contract ${c.contract_id} says $${money(cp)} from ${c.start_date}; invoice ${i.invoice_no} on ${i.invoice_date} charged $${money(up)}: ${q} × $${money(cp - up)} = $${money((cp - up) * q)}.`,
        [ctEv, invEv], { diff_field: "unit_price" });
    } else if (up > cp) {
      if (on("above_contract")) flag("above_contract", [i.invoice_no, c.contract_id], i.customer, (up - cp) * q,
        `Contract ${c.contract_id} says $${money(cp)}; invoice ${i.invoice_no} charged $${money(up)}: we overcharged ${q} × $${money(up - cp)} = $${money((up - cp) * q)}.`,
        [ctEv, invEv], { diff_field: "unit_price" });
    } else if (i.sku === "GLV-NIT-100" && up === 2100 && idt <= dayNum("2026-09-21")) {
      rule("Billed above contract", `${i.invoice_no} billed 21.00 on ${i.invoice_date} for goods shipped earlier: invoice-date price applies, not overbilled`, [i.invoice_no]);
    } else if (i.sku === "GLV-NIT-100" && up === 1850) {
      rule("Below contract price", `${i.invoice_no} billed 18.50 on ${i.invoice_date}, before the 9/15 increase: correct`, [i.invoice_no]);
    }
    if (i.status === "open") {
      const late = asOf - dayNum(i.due_date);
      if (late >= S.overdue_days) {
        if (on("overdue")) flag("overdue", [i.invoice_no], i.customer, toCents(i.amount),
          `Invoice ${i.invoice_no} for $${money(toCents(i.amount))} was due ${i.due_date}; still open ${late} days later.`, [invEv], { diff_field: "due_date" });
      } else if (late > 0) rule("Overdue receivable", `${i.invoice_no} only ${late} days late`, [i.invoice_no]);
    }
  }

  // AP
  const groups = new Map();
  for (const b of bills) { const k = `${b.vendor}|${keynorm(b.vendor_invoice_no)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); }
  for (const [, bs] of groups) for (const extra of bs.slice(1)) if (on("dup_payment"))
    flag("dup_payment", bs.map((b) => b.bill_id), extra.vendor, toCents(extra.amount),
      `Invoice ${bs[0].vendor_invoice_no} and ${extra.vendor_invoice_no} from ${extra.vendor} are the same bill written differently, paid ${bs[0].paid_date} and ${extra.paid_date}: $${money(toCents(extra.amount))} paid twice.`,
      bs.map((b) => ({ system: "AP", id: b.bill_id, fields: evFields(b, { invoice_no: b.vendor_invoice_no, amount: b.amount, paid: b.paid_date }) })),
      { lane: "vendor", diff_field: "invoice_no" });
  const byVendAmt = new Map();
  for (const b of bills) { const k = `${b.vendor}|${b.amount}`; if (!byVendAmt.has(k)) byVendAmt.set(k, new Set()); byVendAmt.get(k).add(keynorm(b.vendor_invoice_no)); }
  for (const [k, ks] of byVendAmt) if (ks.size > 1) {
    const [v, a] = k.split("|");
    rule("Duplicate vendor payment", `${v}: ${ks.size} bills of ${a}, different invoice numbers (recurring)`, [v]);
  }
  const seen = new Set();
  for (const b of bills) {
    const k = `${b.vendor}|${keynorm(b.vendor_invoice_no)}`;
    if (seen.has(k) || !b.po_amount) { seen.add(k); continue; }
    seen.add(k);
    const a = toCents(b.amount), po = toCents(b.po_amount), diff = a - po;
    if (diff > Math.max(S.po_abs_cents, Math.round(po * S.po_pct))) {
      if (on("over_po")) flag("over_po", [b.bill_id, b.po_no], b.vendor, diff,
        `PO ${b.po_no} approved $${money(po)}; bill ${b.bill_id} paid $${money(a)}: $${money(diff)} over.`,
        [{ system: "AP", id: b.bill_id, fields: evFields(b, { amount: money(a) }) }, { system: "AP", id: b.po_no, fields: { po_amount: money(po) } }],
        { lane: "vendor", diff_field: "amount" });
    } else if (diff > 0) rule("Vendor over PO", `${b.bill_id} is ${money(diff)} over PO, under the max(25, 1%) tolerance`, [b.bill_id]);
  }

  // twist templates
  if (on("missing_credit")) {
    const invPrice = new Map();
    for (const s of shipRows) for (const i of invByOrder.get(digits(s.order_no)) || []) invPrice.set(`${digits(s.order_no)}|${s.sku}`, toCents(i.unit_price));
    const credited = new Map(); const seenCm = new Set();
    for (const r of returns) { const k = keynorm(r.credit_memo_no); if (k && !seenCm.has(k)) { seenCm.add(k); const kk = `${digits(r.order_ref)}|${r.sku}`; credited.set(kk, (credited.get(kk) || 0) + toCents(r.credit_amount)); } }
    for (const s of shipRows) {
      const key = `${digits(s.order_no)}|${s.sku}`, ret = returned.get(key) || 0;
      if (!ret) continue;
      const billed = (invByOrder.get(digits(s.order_no)) || []).reduce((a, i) => a + +i.qty, 0);
      const excess = billed - (+s.qty - ret);
      if (excess <= 0) continue;
      const due = excess * invPrice.get(key) - (credited.get(key) || 0);
      const retIds = returns.filter((r) => digits(r.order_ref) === digits(s.order_no)).map((r) => r.return_id);
      if (due > 0) flag("missing_credit", [s.shipment_id, ...retIds], s.cust, due,
        `Customer returned ${ret} ${s.sku} (${[...new Set(retIds)].join(", ")}) on a billed order ${s.order_no}; credits issued $${money(credited.get(key) || 0)}: we owe $${money(due)}.`,
        [{ system: "Returns", id: retIds[0], fields: { qty_returned: String(ret), credit_memo: "none" } }, { system: "Billing", id: s.order_no, fields: evFields(s, { billed_qty: String(billed) }) }],
        { diff_field: "credit_memo" });
      else rule("Credit never issued", `${s.order_no}: ${excess} returned units already credited (${money(credited.get(key) || 0)})`, [s.order_no]);
    }
  }
  if (on("dup_credit_memo")) {
    const cm = new Map();
    for (const r of returns) if (r.credit_memo_no) { const k = keynorm(r.credit_memo_no); if (!cm.has(k)) cm.set(k, []); cm.get(k).push(r); }
    for (const [, rs] of cm) for (const extra of rs.slice(1))
      flag("dup_credit_memo", rs.map((r) => `${r.return_id}/${r.credit_memo_no}`), rs[0].customer, toCents(extra.credit_amount),
        `Credit memo ${rs[0].credit_memo_no} and ${extra.credit_memo_no} are the same credit applied twice: $${money(toCents(extra.credit_amount))} over-credited.`,
        rs.map((r) => ({ system: "Returns", id: r.return_id, fields: evFields(r, { credit_memo: r.credit_memo_no, amount: r.credit_amount }) })),
        { diff_field: "credit_memo" });
  }

  const patterns = findPatterns(flags);
  return { flags, ruledOut, patterns, needsReview, totals: totalsOf(flags, ruledOut) };
}

/** Case-insensitive / digits-only id match for lookup ("so 1060" → SO-1060). */
export function idMatchesQuery(id, query) {
  const q = String(query ?? "").trim();
  if (!q) return false;
  const idS = String(id ?? "");
  if (!idS || idS === "—") return false;
  if (idS.toLowerCase() === q.toLowerCase()) return true;
  if (idS.toLowerCase().includes(q.toLowerCase())) return true;
  const qd = digits(q), idd = digits(idS);
  if (qd && idd && (idd === qd || idS.toLowerCase().includes(qd))) return true;
  return false;
}

function evidenceMatchesQuery(ev, q) {
  if (idMatchesQuery(ev?.id, q)) return true;
  return Object.values(ev?.fields || {}).some((v) => idMatchesQuery(v, q));
}

/** Resolve a lookup query against flags and ruled-out rows. */
export function resolveLookup(query, flags, ruled) {
  const q = String(query ?? "").trim();
  if (!q) return { kind: "not_found", flags: [], ruled: [] };
  const hitFlags = (flags || []).filter((f) =>
    (f.ids || []).some((id) => idMatchesQuery(id, q))
    || (f.evidence || []).some((ev) => evidenceMatchesQuery(ev, q))
    || idMatchesQuery(f.stable_key, q));
  if (hitFlags.length) return { kind: "flagged", flags: hitFlags, ruled: [] };
  const hitRuled = (ruled || []).filter((r) => (r.ids || []).some((id) => idMatchesQuery(id, q)));
  if (hitRuled.length) return { kind: "ruled_out", flags: [], ruled: hitRuled };
  return { kind: "not_found", flags: [], ruled: [] };
}

// ---------- patterns (rule-computed, >= 3 flags sharing one cause) ----------
export function findPatterns(flags) {
  const out = [];
  const sum = (fs) => fs.reduce((a, f) => a + f.amount_cents, 0);
  const gl = flags.filter((f) => f.rule_id === "below_contract" && f.why.includes("$21.00") && f.why.includes("$18.50"));
  if (gl.length >= 3) out.push({ key: "glove_price_9_15", title: "Glove price not updated after 9/15",
    detail: `${gl.length} invoices, ${new Set(gl.map((f) => f.party)).size} customers`, amount_cents: sum(gl),
    keys: gl.map((f) => f.stable_key), fix: "Update GLV-NIT-100 price in billing to 21.00" });
  const byParty = new Map();
  for (const f of flags) if (f.bucket === "recoverable" && f.lane === "customer") { if (!byParty.has(f.party)) byParty.set(f.party, []); byParty.get(f.party).push(f); }
  for (const [p, fs] of byParty) if (fs.length >= 3) out.push({ key: `repeat_${keynorm(p)}`, title: `${p}: repeat issues`,
    detail: `${fs.length} recoverable issues across ${new Set(fs.map((f) => f.rule_id)).size} rules`, amount_cents: sum(fs),
    keys: fs.map((f) => f.stable_key), fix: `Review ${p} billing setup` });
  const fr = flags.filter((f) => f.rule_id === "freight");
  if (fr.length >= 3) out.push({ key: "freight_passthrough", title: "Freight not passed on to rebill customers",
    detail: `${fr.length} shipments, ${new Set(fr.map((f) => f.party)).size} customers`, amount_cents: sum(fr),
    keys: fr.map((f) => f.stable_key), fix: "Turn on freight pass-through for rebill accounts" });
  const dp = flags.filter((f) => f.rule_id === "dup_payment");
  if (dp.length >= 2) out.push({ key: "dup_formatting", title: "Duplicate payments differ only by invoice-number formatting",
    detail: `${dp.length} vendors`, amount_cents: sum(dp), keys: dp.map((f) => f.stable_key), fix: "Normalize vendor invoice numbers before payment" });
  return out.sort((a, b) => b.amount_cents - a.amount_cents);
}

export function totalsOf(flags, ruledOut = []) {
  const t = { recoverable: { n: 0, cents: 0 }, overdue: { n: 0, cents: 0 }, credit_owed: { n: 0, cents: 0 }, ruled_out: ruledOut.length, by_rule: {}, by_seam: {} };
  for (const f of flags) {
    t[f.bucket].n++; t[f.bucket].cents += f.amount_cents;
    const r = (t.by_rule[f.rule] ||= { n: 0, cents: 0 }); r.n++; r.cents += f.amount_cents;
    if (f.bucket === "recoverable") { const s = (t.by_seam[f.seam] ||= { n: 0, cents: 0 }); s.n++; s.cents += f.amount_cents; }
  }
  return t;
}

/** Rank: money at stake, largest first; customers by net (owed to us − we owe). */
export function rankParties(flags) {
  const m = new Map();
  for (const f of flags) {
    if (!m.has(f.party)) m.set(f.party, { party: f.party, lane: f.lane, owed_to_us: 0, we_owe: 0, overdue: 0, flags: [] });
    const p = m.get(f.party); p.flags.push(f);
    if (f.bucket === "recoverable") p.owed_to_us += f.amount_cents;
    else if (f.bucket === "credit_owed") p.we_owe += f.amount_cents;
    else p.overdue += f.amount_cents;
  }
  const all = [...m.values()].map((p) => ({ ...p, net: p.owed_to_us - p.we_owe, flags: p.flags.sort((a, b) => b.amount_cents - a.amount_cents) }));
  const net = (p) => (p.owed_to_us || p.we_owe ? p.net : p.overdue);
  return {
    customers: all.filter((p) => p.lane === "customer").sort((a, b) => Math.abs(net(b)) - Math.abs(net(a)) || b.overdue - a.overdue),
    vendors: all.filter((p) => p.lane === "vendor").sort((a, b) => b.net - a.net),
  };
}

// ---------- reconcile (upsert by stable_key, never delete; v3 lifecycle) ----------
/**
 * @param {any[]} existing  Flag rows already stored (with id, status)
 * @param {Flag[]} fresh    flags from runEngine
 * @returns {{create:any[], update:{id:string,data:any}[], counts:{new:number,cleared:number,needs_review:number,reopened:number}}}
 */
export function reconcileFlags(existing, fresh) {
  const byKey = new Map(existing.map((r) => [r.stable_key, r]));
  const freshKeys = new Set(fresh.map((f) => f.stable_key));
  const create = [], update = [], counts = { new: 0, cleared: 0, needs_review: 0, reopened: 0 };
  for (const f of fresh) {
    const old = byKey.get(f.stable_key);
    if (!old) { create.push({ ...f, status: "open", is_new: true }); counts.new++; continue; }
    const data = { ...f, is_new: false };
    if (old.status === "cleared") { data.status = "open"; data.cleared_by = null; counts.reopened++; }
    update.push({ id: old.id, data });
  }
  for (const old of existing) {
    if (freshKeys.has(old.stable_key)) continue;
    if (old.status === "open") { update.push({ id: old.id, data: { status: "cleared", cleared_by: "data", is_new: false } }); counts.cleared++; }
    else if (["sent", "disputed"].includes(old.status)) {
      update.push({ id: old.id, data: { status: "needs_review", review_reason: "New data changed this line: correction owed" } }); counts.needs_review++;
    }
  }
  return { create, update, counts };
}

/** Allowed flag status transitions (§3.3). */
export const FLAG_TRANSITIONS = {
  open: ["dismissed", "sent"],
  sent: ["disputed", "recovered", "credited", "needs_review"],
  disputed: ["recovered"],
  dismissed: [],
  recovered: [],
  credited: [],
  cleared: ["open"],
  needs_review: [],
};

/** Role: user may dismiss/dispute; admin may do the rest. */
export function flagTransitionAllowed(from, to, role) {
  const ok = (FLAG_TRANSITIONS[from] || []).includes(to);
  if (!ok) return { ok: false, error: `Cannot transition ${from} → ${to}` };
  if (role === "user" && !["dismissed", "disputed"].includes(to)) {
    return { ok: false, error: "Controller role required" };
  }
  return { ok: true };
}

/** Dollar buckets for the H3 settlement bar. */
export function settlementBuckets(flags) {
  const buckets = {
    open: { cents: 0, count: 0 },
    sent: { cents: 0, count: 0 },
    recovered: { cents: 0, count: 0 },
    cleared: { cents: 0, count: 0 },
  };
  for (const f of flags || []) {
    if (f.status === "open" || f.status === "disputed") {
      buckets.open.cents += f.amount_cents; buckets.open.count++;
    } else if (f.status === "sent") {
      buckets.sent.cents += f.amount_cents; buckets.sent.count++;
    } else if (f.status === "recovered" || f.status === "credited") {
      buckets.recovered.cents += f.amount_cents; buckets.recovered.count++;
    } else if (f.status === "cleared") {
      buckets.cleared.cents += f.amount_cents; buckets.cleared.count++;
    }
  }
  return buckets;
}

/** Count AuditEvent deltas after last_seen_at for the visit scorecard. */
export function visitDeltasSince(events, lastSeenAt) {
  const since = { new: 0, cleared: 0, sent: 0, recovered: 0 };
  const cut = lastSeenAt ? Date.parse(lastSeenAt) : 0;
  for (const ev of events || []) {
    const t = Date.parse(ev.created_at || ev.created_date || 0);
    if (cut && !(t > cut)) continue;
    if (ev.action === "run_checks" && ev.after) {
      since.new += ev.after.new || 0;
      since.cleared += ev.after.cleared || 0;
    } else if (ev.action === "transition_flag") {
      const to = ev.after?.status;
      if (to === "sent") since.sent++;
      if (to === "recovered" || to === "credited") since.recovered++;
      if (to === "cleared") since.cleared++;
    } else if (ev.action === "send_letter") {
      since.sent += (ev.after?.flag_keys || []).length || (ev.after?.count || 0);
    }
  }
  return since;
}

// ---------- letters (shared: sections, totals, receipt, templates, AI validator) ----------
export const LETTER_BEC_FOOTER = "Northline will never ask you to change bank details by email.";
export const LETTER_CHECKED_CREDITS = "We checked: no credits owed.";

/** Reject AI greeting/closing that contains digits, URLs, @, or bank words. */
export function validateLetterAiText(text) {
  const t = String(text ?? "");
  if (!t.trim()) return false;
  if (/\d/.test(t)) return false;
  if (/https?:\/\//i.test(t) || /\bwww\./i.test(t)) return false;
  if (/@/.test(t)) return false;
  if (/\b(bank|account|routing|wire|IBAN|SWIFT)\b/i.test(t)) return false;
  return true;
}

export function letterToneGreeting(party, tone) {
  if (tone === "firm") return `${party},`;
  if (tone === "nudge") return `Hi ${party},`;
  return `Hello ${party} team,`;
}

export function letterToneClosing(tone) {
  if (tone === "firm") return "Please settle these items promptly.";
  if (tone === "nudge") return "Happy to walk through any line with you.";
  return "Thank you for partnering with Northline.";
}

export function vendorRefundEmail(vendor) {
  const slug = String(vendor ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `ap@${slug}.example`;
}

export function pickBillingEmail(contracts, party) {
  const row = (contracts || []).find((c) => c.customer_name === party && c.billing_email);
  return row?.billing_email || null;
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function letterLineFromFlag(f) {
  return {
    key: f.stable_key,
    text: f.why || f.title || f.rule,
    amount_cents: f.amount_cents,
    evidence: f.evidence || [],
    flag: f,
  };
}

function letterReceiptFromSections(sections) {
  const rows = [];
  for (const sec of sections) {
    for (const line of sec.lines) {
      if (!line.evidence?.length) continue;
      for (const ev of line.evidence) {
        rows.push({
          line_key: line.key,
          system: ev.system,
          id: ev.id,
          fields: Object.fromEntries(
            Object.entries(ev.fields || {}).filter(([k]) => k !== "import_batch" && k !== "source_row"),
          ),
        });
      }
    }
  }
  return rows;
}

function letterBodyText(draft) {
  const parts = [draft.greeting, ""];
  for (const sec of draft.sections) {
    parts.push(sec.title);
    for (const line of sec.lines) {
      const amt = line.amount_cents ? ` ${fmt(line.signed_cents ?? line.amount_cents)}` : "";
      parts.push(`- ${line.text}${amt}`);
    }
    parts.push("");
  }
  parts.push(draft.closing, "", draft.footer);
  return parts.join("\n");
}

/**
 * Build a letter draft in code (numbers + sections). Greeting/closing are templates unless overridden.
 * @returns {{to,subject,greeting,closing,sections,receipt,total_cents,footer,warnings,flag_keys,body,kind,party,tone}}
 */
export function buildLetterDraft({
  party,
  kind = "customer",
  tone = "warm",
  flags = [],
  contracts = [],
  exclude_keys = [],
  rule_enabled = {},
  greeting,
  closing,
  subject,
}) {
  const excl = new Set(exclude_keys || []);
  const warnings = [];
  const partyFlags = (flags || []).filter((f) => f.party === party);
  let selected = [];
  if (kind === "vendor") {
    selected = partyFlags.filter((f) => f.status === "open" && f.lane === "vendor" && !excl.has(f.stable_key));
  } else if (kind === "correction") {
    selected = partyFlags.filter((f) => f.status === "needs_review" && !excl.has(f.stable_key));
  } else {
    selected = partyFlags.filter((f) => f.status === "open" && f.lane === "customer" && !excl.has(f.stable_key));
  }

  const sections = [];
  if (kind === "vendor") {
    sections.push({
      title: "Amounts to recover",
      lines: selected.sort((a, b) => b.amount_cents - a.amount_cents).map((f) => {
        const line = letterLineFromFlag(f);
        line.signed_cents = f.amount_cents;
        return line;
      }),
    });
  } else if (kind === "correction") {
    sections.push({
      title: "Correction owed",
      lines: selected.sort((a, b) => b.amount_cents - a.amount_cents).map((f) => {
        const line = letterLineFromFlag(f);
        line.signed_cents = f.bucket === "credit_owed" ? -f.amount_cents : f.amount_cents;
        line.text = `${f.review_reason || "Correction owed"}: ${f.why || f.rule}`;
        return line;
      }),
    });
  } else {
    const credits = selected.filter((f) => f.bucket === "credit_owed");
    const recoverable = selected.filter((f) => f.bucket === "recoverable");
    const overdue = selected.filter((f) => f.bucket === "overdue");
    const rule8On = rule_enabled.above_contract !== false;
    const creditLines = credits.sort((a, b) => b.amount_cents - a.amount_cents).map((f) => {
      const line = letterLineFromFlag(f);
      line.signed_cents = -f.amount_cents;
      return line;
    });
    if (!creditLines.length && rule8On) {
      creditLines.push({
        key: "_checked_credits",
        text: LETTER_CHECKED_CREDITS,
        amount_cents: 0,
        signed_cents: 0,
        evidence: [],
      });
    }
    sections.push({ title: "Credits we owe you", lines: creditLines });
    sections.push({
      title: "Billing we missed",
      lines: recoverable.sort((a, b) => b.amount_cents - a.amount_cents).map((f) => {
        const line = letterLineFromFlag(f);
        line.signed_cents = f.amount_cents;
        return line;
      }),
    });
    sections.push({
      title: "Overdue balance",
      lines: overdue.sort((a, b) => b.amount_cents - a.amount_cents).map((f) => {
        const line = letterLineFromFlag(f);
        line.signed_cents = f.amount_cents;
        return line;
      }),
    });
  }

  const total_cents = sections.reduce(
    (a, sec) => a + sec.lines.reduce((b, line) => b + (line.signed_cents || 0), 0),
    0,
  );
  const flag_keys = selected.map((f) => f.stable_key);
  const to = kind === "vendor" ? vendorRefundEmail(party) : pickBillingEmail(contracts, party);
  if (!to) warnings.push("No recipient on file");
  const greet = greeting && validateLetterAiText(greeting) ? greeting : letterToneGreeting(party, tone);
  const close = closing && validateLetterAiText(closing) ? closing : letterToneClosing(tone);
  const defaultSubject =
    kind === "vendor"
      ? `Refund request · ${party}`
      : kind === "correction"
        ? `Correction · ${party}`
        : total_cents < 0
          ? `Credit letter · ${party}`
          : `Settlement · ${party}`;
  const draft = {
    party,
    kind,
    tone,
    to,
    subject: subject || defaultSubject,
    greeting: greet,
    closing: close,
    sections,
    receipt: letterReceiptFromSections(sections),
    total_cents,
    footer: LETTER_BEC_FOOTER,
    warnings,
    flag_keys,
  };
  draft.body = letterBodyText(draft);
  return draft;
}
