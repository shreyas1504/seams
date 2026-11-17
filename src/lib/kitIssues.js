// Issues: one Linear-style issue per cause, built from findings.csv rows (+ Evidence, + Decisions).
// Everything here is deterministic. The optional AI narrative is checked against the rows before it is shown.
import { fmt } from "@/lib/engine/engine.js";

const ISS_URGENT_CENTS = 500000; // $5,000
const ISS_HIGH_CENTS = 100000; // $1,000

/** Stable short reference per cause, e.g. SEAM-4821 (same cause → same id across re-runs and months). */
export function issRef(cause) {
  let h = 5381;
  for (const ch of String(cause || "")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `SEAM-${1000 + (h % 9000)}`;
}

export function issPriority(rows) {
  const cents = Math.abs(rows.reduce((a, r) => a + r.signed_cents, 0));
  const rule = rows[0]?.rule || "";
  if (/bank/i.test(rule) || cents >= ISS_URGENT_CENTS) return { level: 4, label: "Urgent" };
  if (cents >= ISS_HIGH_CENTS) return { level: 3, label: "High" };
  if (cents > 0 || /reply|credit/i.test(rule)) return { level: 2, label: "Medium" };
  return { level: 1, label: "Low" };
}

/** Who owns the fix, by seam and problem. Names are the clerks who appear in Northline's data. */
export function issAssignee(rows) {
  const seam = rows[0]?.seam || "";
  const rule = rows[0]?.rule || "";
  const cents = Math.abs(rows.reduce((a, r) => a + r.signed_cents, 0));
  let who;
  if (/AP/.test(seam) && /PO|accepted|freight/i.test(rule)) who = { name: "Raj Mehta", role: "Purchasing" };
  else if (/AP|Vendor/.test(seam)) who = { name: "Lisa Okoro", role: "AP clerk" };
  else if (/Customer/.test(seam) || /reply/i.test(rule)) who = { name: "Jess Fong", role: "Customer service" };
  else who = { name: "Mike Tran", role: "Billing clerk" };
  return { ...who, escalate: cents >= ISS_URGENT_CENTS || /bank/i.test(rule) ? "Dana Ruiz" : null };
}

/** Fix the source: what to change so the cause stops producing new lines. */
export function issSourceFix(rule) {
  const r = String(rule || "");
  if (/old price/i.test(r)) return "Finish loading the Sep 14 price changes in QuickBooks for these items; Mike's note says a handful were left on the old price.";
  if (/old tier/i.test(r)) return "Update the customer's price tier in QuickBooks from the date in customers.csv, then re-rate open invoices.";
  if (/contract/i.test(r)) return "Match QuickBooks price levels to contract_prices.csv: start and end each contract on its dates.";
  if (/tax/i.test(r)) return "Fix the item's taxable flag or the customer's exemption dates in QuickBooks so tax is right on every new invoice.";
  if (/fee/i.test(r)) return "Make the delivery fee automatic: $35 only when the merchandise is under $300, never during a free-delivery period.";
  if (/never invoiced|left off|cases than delivered|not delivered/i.test(r)) return "Invoice from the signed delivery log, not the order, and check daily that every delivery has one invoice within 3 business days.";
  if (/invoiced twice/i.test(r)) return "Block a second invoice for a delivery ID that is already billed.";
  if (/wrong customer/i.test(r)) return "Pick the bill-to from the delivery's customer ID, not a sister location chosen by name.";
  if (/above PO|than accepted|freight/i.test(r)) return "Three-way match every bill to the PO price, the accepted quantity and the supplier's freight terms before approval.";
  if (/entered twice/i.test(r)) return "Reject a supplier invoice number that is already in QuickBooks, ignoring dashes and spaces.";
  if (/bank/i.test(r)) return "Hold the bills, call the supplier at the number on file, and restore the account on file. Never change remit details from an email.";
  if (/fake/i.test(r)) return "Report and block the sender's domain, and tell AP the supplier never sent it.";
  if (/reply/i.test(r)) return "Reply today and add a next-business-day reply alert on the orders inbox.";
  if (/credit/i.test(r)) return "Issue the promised credit memo and track every promised credit to closure within 5 business days.";
  return "Fix the record that produces this cause so new lines stop appearing.";
}

const issDay = (iso) => String(iso || "").slice(0, 10);
export function issShortDate(iso) {
  const d = issDay(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** All issues from the finding objects (kitToFlag shape), biggest priority then dollars first. */
export function kitIssues(flags) {
  const by = new Map();
  for (const f of flags) {
    if (!by.has(f.cause)) by.set(f.cause, []);
    by.get(f.cause).push(f);
  }
  const out = [];
  for (const [cause, rows] of by) {
    rows.sort((a, b) => Math.abs(b.signed_cents) - Math.abs(a.signed_cents));
    const cents = rows.reduce((a, r) => a + r.signed_cents, 0);
    const counts = { open: 0, sent: 0, dismissed: 0 };
    for (const r of rows) counts[r.status === "sent" ? "sent" : r.status === "dismissed" ? "dismissed" : "open"] += 1;
    const status = counts.open === rows.length ? "New" : counts.open === 0 ? (counts.dismissed === rows.length ? "Dismissed" : "Done") : "In progress";
    const dates = rows.map((r) => issDay(r.date)).filter(Boolean).sort();
    const months = new Set(rows.map((r) => r.month).filter(Boolean));
    out.push({
      key: cause,
      ref: issRef(cause),
      cause,
      rows,
      cents,
      counts,
      status,
      seam: rows[0].seam,
      rule: rows[0].rule,
      priority: issPriority(rows),
      assignee: issAssignee(rows),
      labels: [rows[0].seam, rows[0].rule, ...[...months].map((m) => m.charAt(0).toUpperCase() + m.slice(1, 3)), ...(months.has("september") && months.has("october") ? ["Reopened"] : [])],
      firstDate: dates[0] || "",
      lastDate: dates[dates.length - 1] || "",
    });
  }
  return out.sort((a, b) => b.priority.level - a.priority.level || Math.abs(b.cents) - Math.abs(a.cents));
}

/** Timeline: first seen, each line by date (top 10), decisions, last seen. */
export function issTimeline(issue) {
  const ev = [];
  for (const r of issue.rows) {
    if (r.date) ev.push({ date: issDay(r.date), kind: "line", text: `${r.ids.join(" · ")} · ${r.party || r.rule}`, cents: r.signed_cents, key: r.stable_key });
    if (r.decision?.decided_at) ev.push({ date: issDay(r.decision.decided_at), kind: r.decision.status, text: `${r.decision.status === "approved" ? "Approved" : "Dismissed"} by ${r.decision.decided_by || "Dana"}${r.decision.reason ? ` · ${r.decision.reason}` : ""}`, key: `${r.stable_key}:d` });
  }
  ev.sort((a, b) => a.date.localeCompare(b.date));
  const lines = ev.filter((e) => e.kind === "line");
  const shown = lines.length > 10 ? [...lines.slice(0, 5), { date: "", kind: "gap", text: `${lines.length - 10} more lines`, key: "gap" }, ...lines.slice(-5)] : lines;
  return [...shown, ...ev.filter((e) => e.kind !== "line")];
}

/** Rows the AI may read: one per finding, id = finding_id, text = explanation + evidence. Nothing else. */
export function issEvidenceRows(issue, max = 12) {
  return issue.rows.slice(0, max).map((r) => ({
    id: r.stable_key,
    text: [r.why, ...(r.evidence || []).map((e) => `${e.file}: ${e.fields.shows}${e.fields.expected ? ` (rule: ${e.fields.expected})` : ""}`), `amount ${(r.signed_cents / 100).toFixed(2)}`, r.date ? `date ${issDay(r.date)}` : ""].filter(Boolean).join(" | ").slice(0, 400),
  }));
}

/** Template narrative from the records (used when AI is off or its answer fails the checks). */
export function issFallbackNarrative(issue) {
  const top = issue.rows[0];
  const n = issue.rows.length;
  const span = issue.firstDate ? (issue.firstDate === issue.lastDate ? ` on ${issShortDate(issue.firstDate)}` : ` from ${issShortDate(issue.firstDate)} to ${issShortDate(issue.lastDate)}`) : "";
  const money = issue.cents < 0 ? `${fmt(-issue.cents)} owed back` : issue.cents === 0 ? "no dollars, but it needs action" : `${fmt(issue.cents)} to recover`;
  const s = [
    { text: `${n} ${n === 1 ? "line" : "lines"} share this cause${span}, ${money}.`, cites: issue.rows.slice(0, 3).map((r) => r.stable_key) },
    { text: `Biggest: ${top.why || top.rule}`, cites: [top.stable_key] },
  ];
  if (n > 1) s.push({ text: `It touches ${new Set(issue.rows.map((r) => r.party).filter(Boolean)).size || 1} ${/AP/.test(issue.seam) ? "supplier" : "customer"} account(s); the same record setting produced every line.`, cites: [issue.rows[n - 1].stable_key] });
  return { sentences: s, source: "template" };
}

/** Keep an AI narrative only if every sentence cites a real row and every number it states is in the rows. */
export function issCheckNarrative(raw, issue, rows) {
  let obj = raw;
  if (typeof obj === "string") { try { obj = JSON.parse(obj); } catch { return null; } }
  obj = obj?.data ?? obj?.output ?? obj;
  const sentences = Array.isArray(obj?.sentences) ? obj.sentences : null;
  if (!sentences?.length) return null;
  const ids = new Set(rows.map((r) => r.id));
  const corpus = [issue.cause, ...rows.map((r) => r.text)].join(" ").replace(/,/g, "");
  const nums = (t) => (String(t).replace(/,/g, "").match(/\d+(\.\d+)?/g) || []).filter((x) => x.length > 1 || Number(x) > 9);
  const clean = [];
  for (const s of sentences.slice(0, 6)) {
    const cites = (s?.cites || []).filter((c) => ids.has(c));
    if (!s?.text || !cites.length) return null;
    if (nums(s.text).some((n) => !corpus.includes(n))) return null;
    clean.push({ text: String(s.text).slice(0, 300), cites });
  }
  return { sentences: clean, source: "ai" };
}
