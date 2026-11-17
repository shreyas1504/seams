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

/** Dana's Monday note for Frank: what came back last week, what is still at risk, what he needs to decide.
 *  Built only from findings.csv amounts and the Decisions table, so every number matches the file. */
export function kitMondayNote(flags, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const sum = (fs) => fs.reduce((a, f) => a + f.signed_cents, 0);
  const decidedLastWeek = (f) => f.decision?.decided_at && new Date(f.decision.decided_at) >= weekAgo;
  const approvedWeek = flags.filter((f) => f.status === "sent" && decidedLastWeek(f));
  const back = { cents: sum(approvedWeek.filter((f) => f.signed_cents > 0)), n: approvedWeek.filter((f) => f.signed_cents > 0).length, credits: -sum(approvedWeek.filter((f) => f.signed_cents < 0)) };
  const open = flags.filter((f) => f.status === "open");
  const bank = open.filter((f) => /bank account/i.test(f.rule));
  const owed = open.filter((f) => f.signed_cents > 0 && !/bank account/i.test(f.rule));
  const weOwe = open.filter((f) => f.signed_cents < 0);
  const risk = { collect: sum(owed), payments: sum(bank), credits: -sum(weOwe), total: sum(owed) + sum(bank) };
  const issues = kitIssues(flags);
  const decide = [];
  for (const i of issues.filter((x) => /bank account/i.test(x.rule) && x.counts.open)) {
    decide.push({ ref: i.ref, text: `Keep ${i.rows[0].party || "the supplier"}'s ${i.counts.open} bill(s) (${fmt(Math.abs(i.cents))}) on hold until the supplier confirms its bank by phone.`, cents: Math.abs(i.cents) });
  }
  const reopened = issues.filter((i) => i.labels.includes("Reopened") && i.counts.open && !/bank account/i.test(i.rule));
  if (reopened.length) {
    const top = reopened.slice(0, 3);
    decide.push({ ref: top.map((i) => i.ref).join(", "), text: `${reopened.length} cause(s) slipped again in October (e.g. ${top.map((i) => i.cause.toLowerCase()).join("; ")}). Approve fixing the source, not just the invoices.`, cents: Math.abs(sum(reopened.flatMap((i) => i.rows))) });
  }
  const bigCredit = issues.filter((i) => i.cents <= -100000 && i.counts.open).slice(0, 2);
  for (const i of bigCredit) decide.push({ ref: i.ref, text: `Approve ${fmt(-i.cents)} in credits we owe: ${i.cause.toLowerCase()}.`, cents: -i.cents });
  const bigCollect = issues.filter((i) => i.cents >= 500000 && i.counts.open && !/bank/i.test(i.rule)).slice(0, 2);
  for (const i of bigCollect) decide.push({ ref: i.ref, text: `Send catch-up invoices for ${fmt(i.cents)}: ${i.cause.toLowerCase()} (${i.rows.length} lines).`, cents: i.cents });
  const weekLabel = `${weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const lines = [
    `Frank, here is this week's money check (${weekLabel}).`,
    "",
    `1. What we got back: ${back.n ? `${fmt(back.cents)} approved to collect across ${back.n} line(s)` : "nothing approved to collect yet this week"}${back.credits ? `, and ${fmt(back.credits)} in credits issued to customers` : ""}.`,
    `2. Still at risk: ${fmt(risk.total)}. That is ${fmt(risk.collect)} we have not billed or collected${risk.payments ? `, plus ${fmt(risk.payments)} in supplier payments on hold for bank-change checks` : ""}. We also owe customers ${fmt(risk.credits)} in credits.`,
    `3. What I need from you:`,
    ...(decide.length ? decide.slice(0, 5).map((d, k) => `   ${String.fromCharCode(97 + k)}) ${d.text} [${d.ref}]`) : ["   Nothing this week."]),
    "",
    "Every amount comes from our findings file; nothing goes out without my approval.",
    "Dana",
  ];
  return { back, risk, decide: decide.slice(0, 5), text: lines.join("\n"), weekLabel };
}

/** What the chat AI may read for one question: totals, every issue in one line, and the findings most
 *  related to the question (record IDs, names, words). Small enough for one prompt; nothing else is sent. */
export function kitAskContext(question, flags, max = 24) {
  const q = String(question || "").toLowerCase();
  const sum = (fs) => fs.reduce((a, f) => a + f.signed_cents, 0);
  const money = (c) => (c / 100).toFixed(2);
  const issues = kitIssues(flags);
  const open = flags.filter((f) => f.status === "open");
  const months = [...new Set(flags.map((f) => f.month).filter(Boolean))];
  const totals = [
    `findings ${flags.length}, open ${open.length}, approved ${flags.filter((f) => f.status === "sent").length}, dismissed ${flags.filter((f) => f.status === "dismissed").length}`,
    `open to collect ${money(sum(open.filter((f) => f.signed_cents > 0)))}; open owed to customers ${money(-sum(open.filter((f) => f.signed_cents < 0)))}; net ${money(sum(flags))}`,
    ...months.map((m) => `${m}: ${flags.filter((f) => f.month === m).length} findings, net ${money(sum(flags.filter((f) => f.month === m)))}`),
  ];
  const issueLines = issues.map((i) => `${i.ref} | ${i.cause} | ${i.seam} | owner ${i.assignee.name} (${i.assignee.role}) | ${i.priority.label} | ${i.status} | ${i.rows.length} lines | ${money(i.cents)} | ${i.firstDate || "?"} to ${i.lastDate || "?"} | months ${[...new Set(i.rows.map((r) => r.month))].join("+")}`);
  const refOf = new Map(issues.map((i) => [i.cause, i.ref]));
  const words = q.split(/[^a-z0-9-]+/).filter((w) => w.length >= 3 && !["the", "and", "what", "which", "who", "how", "why", "did", "does", "for", "are", "our", "with", "from", "this", "that", "much", "many"].includes(w));
  const refHit = (q.match(/seam-\d{4}/g) || []).map((x) => x.toUpperCase());
  const scored = flags.map((f) => {
    const hay = `${f.ids.join(" ")} ${f.party} ${f.cause} ${f.rule} ${f.why}`.toLowerCase();
    let s = 0;
    for (const id of f.ids) if (q.includes(String(id).toLowerCase())) s += 20;
    if (refHit.includes(refOf.get(f.cause))) s += 12;
    for (const w of words) if (hay.includes(w)) s += /\d/.test(w) ? 6 : 1;
    return [s + Math.abs(f.signed_cents) / 1e7, f];
  }).filter(([s]) => s >= 1).sort((a, b) => b[0] - a[0]).slice(0, max).map(([, f]) => f);
  const rows = scored.map((f) => `${f.stable_key} | ${refOf.get(f.cause)} | ${f.ids.join(" ")} | ${f.party} | ${f.rule} | ${money(f.signed_cents)} | ${f.date || ""} | ${f.status} | ${f.why} | ${(f.evidence || []).map((e) => `${e.file}: ${e.fields.shows}${e.fields.expected ? ` (rule: ${e.fields.expected})` : ""}`).join("; ")}`.slice(0, 420));
  const text = ["TOTALS", ...totals, "", "ISSUES (ref | cause | seam | owner | priority | status | lines | amount | dates | months)", ...issueLines, "", "MATCHING FINDINGS (finding_id | issue | record IDs | party | problem | amount | date | status | why | evidence)", ...(rows.length ? rows : ["(none matched the question)"])].join("\n");
  return { text: text.slice(0, 19000), refs: new Set(issues.map((i) => i.ref)), ids: new Set(flags.flatMap((f) => [f.stable_key, ...f.ids.map(String)])) };
}

/** Keep an AI chat answer only if every number it states appears in the context it was given. */
export function kitCheckChat(raw, ctx) {
  let obj = raw;
  if (typeof obj === "string") { try { obj = JSON.parse(obj); } catch { obj = { answer: obj }; } }
  obj = obj?.data ?? obj?.output ?? obj;
  const answer = String(obj?.answer || "").trim();
  if (!answer) return null;
  const corpus = ctx.text.replace(/,/g, "");
  const nums = (answer.replace(/,/g, "").match(/\d+(\.\d+)?/g) || []).filter((x) => !(x.length <= 2 && Number(x) <= 31));
  const bad = nums.filter((n) => !corpus.includes(n) && !corpus.includes(Number(n).toFixed(2)));
  if (bad.length) return { rejected: true, bad };
  const refs = [...new Set([...(obj.cites || []), ...(answer.match(/SEAM-\d{4}/g) || [])])].filter((r) => ctx.refs.has(r) || ctx.ids.has(r)).slice(0, 8);
  return { answer, refs, model: obj.model || "" };
}
