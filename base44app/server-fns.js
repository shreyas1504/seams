import { createServerFn } from "@tanstack/react-start";
import { chat, maxIterations } from "@tanstack/ai";
import { z } from "zod";
import { secrets } from "base44:runtime";
import { gatewayModel } from "@/lib/ai.server";
import { requireUser } from "@/lib/auth-middleware";

// Seams AI. Uses NVIDIA Nemotron when the NVIDIA_API_KEY secret is set, else the Base44 AI gateway.
// The browser re-checks every answer: numbers must appear in the context it sent.
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3.5-bolt-e4b";
function nvidiaModel() {
  try { return secrets.get("NVIDIA_MODEL") || NVIDIA_DEFAULT_MODEL; } catch { return NVIDIA_DEFAULT_MODEL; }
}

function nvidiaKey() {
  try { return secrets.get("NVIDIA_API_KEY") || null; } catch { return null; }
}

function parseJson(text) {
  const t = String(text || "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}

async function nemotron(key, messages, maxTokens) {
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: nvidiaModel(), messages, temperature: 0.2, max_tokens: maxTokens, stream: false, chat_template_kwargs: { enable_thinking: false } }),
  });
  if (!res.ok) throw new Error(`nemotron ${res.status}`);
  const json = await res.json();
  return parseJson(json?.choices?.[0]?.message?.content);
}

// ---- Issues: "what happened" for one cause ----
const ISSUE_SYSTEM = [
  "You are Northline Supply's controller explaining one billing or payables issue to Dana, the ops manager.",
  "Use ONLY the rows given. Each row has an id and text. Do not use outside knowledge.",
  "Write 2 to 4 short plain sentences: what went wrong, when it started, which system slipped, and who is affected.",
  "Every sentence must list in cites the ids of the rows it relies on. Copy numbers, dates and record IDs exactly as they appear in the rows; never compute new totals.",
  "No advice about what to do; no em dashes.",
  'Answer with JSON only: {"sentences":[{"text":"...","cites":["row id"]}]}',
].join(" ");
const IssueAnswer = z.object({ sentences: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })) });

export const explainIssue = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ title: z.string().max(240), rows: z.array(z.object({ id: z.string().max(120), text: z.string().max(500) })).min(1).max(12) }))
  .handler(async ({ data, context }) => {
    const user = JSON.stringify({ issue: data.title, rows: data.rows });
    const key = nvidiaKey();
    if (key) {
      try { return { ...IssueAnswer.parse(await nemotron(key, [{ role: "system", content: ISSUE_SYSTEM }, { role: "user", content: user }], 700)), model: "Nemotron" }; } catch { /* fall back */ }
    }
    const result = await chat({ adapter: gatewayModel(context.getBase44()), systemPrompts: [ISSUE_SYSTEM], messages: [{ role: "user", content: user }], outputSchema: IssueAnswer, agentLoopStrategy: maxIterations(1) });
    return { ...result, model: "Base44 AI" };
  });

// ---- Ask Seams: chat over the findings ----
const ASK_SYSTEM = [
  "You are Seams, the assistant for Dana, operations manager at Northline Supply (a restaurant supply distributor). You help her understand billing and payables findings and decide what to do.",
  "The CONTEXT has TOTALS, every ISSUE (ref like SEAM-1234, cause, system seam, owner, priority, status, lines, amount, dates) and the MATCHING FINDINGS for the question (finding_id, issue ref, record IDs, party, problem, amount, date, status, why, evidence).",
  "Use ONLY the CONTEXT and the conversation. Never invent a customer, supplier, record or number.",
  "",
  "How to write the answer (plain text, short lines):",
  "Line 1: the direct answer in one sentence, naming who and the key amount.",
  "Then 2 to 5 lines that each start with '- ' and give one concrete fact from the CONTEXT: the issue ref and its owner, the record IDs (invoice, bill, delivery, PO, email), the dates, and the evidence (for example the bank account digits on the bill vs the ones on file, or the billed price vs the contract price).",
  "Last line starts with 'Next step: ' and says what Dana should do in the app and who owns it (for example approve a catch-up invoice, issue a credit memo, reply to the customer, dispute with the supplier, or hold the payment and call the number on file).",
  "For broad questions (how much, biggest leaks, what changed, what first), use TOTALS and ISSUES and list the top 3 issues with ref, cause and amount, biggest first.",
  "For a follow-up, answer it using the earlier turns; do not repeat the whole previous answer.",
  "If the CONTEXT does not have the answer, say so in one line and suggest 2 questions it can answer.",
  "",
  "Numbers: copy every amount, date and record ID exactly as written in the CONTEXT; you may write amounts as $1,234.56. Never add, subtract, average or estimate. If a total is not in the CONTEXT, do not state one. Positive amounts are money to collect; negative amounts are money Northline owes back.",
  "You recommend; you never send or change anything. Dana approves in the app. No em dashes.",
  "",
  "Example (made-up data, only to show the shape):",
  '{"answer":"Harbor Diner\'s bill from Acme Produce is on hold because it asks us to pay a bank account that is not the one on file ($812.40).\\n- SEAM-0000 Unverified bank account, owner Lisa Okoro (AP), Urgent\\n- Bill B-00000 dated 2026-01-05 asks for account ending 1111; the account on file ends 2222\\n- The change came only by email (M-000000), with no call-back on record\\nNext step: keep the payment on hold and have Lisa call Acme on the number on file before paying.","cites":["SEAM-0000","B-00000"]}',
  "",
  'Answer with JSON only: {"answer":"...","cites":["SEAM-1234 or finding_id or record ID"]}',
].join("\n");
const AskAnswer = z.object({ answer: z.string(), cites: z.array(z.string()) });

// Same test the browser applies: every number in the answer must appear in the context.
function badNumbers(answer, ctx) {
  const corpus = String(ctx).replace(/,/g, "");
  const nums = (String(answer).replace(/,/g, "").match(/\d+(\.\d+)?/g) || []).filter((x) => !(x.length <= 2 && Number(x) <= 31));
  return nums.filter((n) => !corpus.includes(n) && !corpus.includes(Number(n).toFixed(2)));
}
function weakAnswer(answer) {
  const a = String(answer || "");
  return a.length < 140 || !/(SEAM-\d{4}|\d)/.test(a) || (a.split("\n").filter((l) => l.trim()).length < 2 && a.length < 300);
}
// When the model cites nothing, point at the issues and records of the best matching findings.
function contextCites(ctx) {
  const at = ctx.indexOf("MATCHING FINDINGS");
  if (at < 0) return [];
  const out = [];
  for (const line of ctx.slice(at).split("\n").slice(1, 4)) {
    const cols = line.split(" | ");
    if (cols.length < 3) continue;
    if (/^SEAM-\d{4}$/.test(cols[1])) out.push(cols[1]);
    out.push(cols[0]);
  }
  return [...new Set(out)];
}
function normalise(r) {
  const o = r?.answer !== undefined ? r : r?.data ?? r?.output ?? r?.object ?? r;
  return { answer: String(o?.answer || "").trim(), cites: Array.isArray(o?.cites) ? o.cites.map(String) : [] };
}


// The small model often stops after one sentence. When it does, add the concrete lines from the
// context itself (issue ref, owner, records, amount, date, evidence) and a next step, so every
// answer is specific. These lines only copy text from the context, so they pass the number check.
function money(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  if (n === 0) return "no amount";
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `$${v} owed back` : `$${v}`;
}
const PRIORITY = { urgent: 0, high: 1, medium: 2, low: 3 };
function cols(line) { return line.split(" | ").map((c) => c.trim()); }
function section(ctx, head) {
  const at = ctx.indexOf(head);
  if (at < 0) return [];
  const out = [];
  for (const line of ctx.slice(at).split("\n").slice(1)) { if (!line.trim()) break; out.push(line); }
  return out;
}
function nextStep(rule, amount, owner) {
  const r = String(rule).toLowerCase();
  const who = owner ? `. Owner: ${owner}` : "";
  if (/bank/.test(r)) return `Next step: keep the payment on hold and call the supplier on the number on file before paying${who}.`;
  if (/email|reply/.test(r)) return `Next step: approve the drafted reply to the customer${who}.`;
  if (Number(amount) < 0) return `Next step: approve a credit memo to the customer${who}.`;
  if (/never invoiced|left off|not invoiced|missing/.test(r)) return `Next step: approve the catch-up invoice${who}.`;
  if (/supplier|bill|po|price|over/.test(r)) return `Next step: dispute the overcharge with the supplier and hold that amount${who}.`;
  return `Next step: open the issue, check the lines and approve or dismiss each one${who}.`;
}
function detailLines(ctx, question) {
  const issues = new Map(section(ctx, "ISSUES (").map((l) => { const c = cols(l); return [c[0], c]; }));
  const rows = section(ctx, "MATCHING FINDINGS").map(cols).filter((c) => c.length >= 7);
  const lines = [];
  const q = String(question || "").toLowerCase();
  const broad = /\b(most|biggest|largest|top|total|how much|losing|lose|lost|leak|first|priority|summary|overall|changed|worst)\b/.test(q) && !/seam-\d{4}|\b[a-z]{1,4}-\d{4,}/i.test(q);
  if (rows.length && !broad) {
    const top = rows.slice(0, 3);
    const iss = issues.get(top[0][1]);
    if (iss) lines.push(`- ${iss[0]} ${iss[1]}, ${iss[3]}, ${iss[4]}, ${iss[6]}, total ${money(iss[7])}`);
    for (const c of top) lines.push(`- ${c[2]} (${c[3]}): ${c[4]}, ${money(c[5])}${c[6] ? ` on ${c[6]}` : ""}`);
    const ev = top[0][9];
    if (ev) lines.push(`- Evidence: ${ev.slice(0, 220)}`);
    lines.push(nextStep(top[0][4], top[0][5], iss ? iss[3].replace(/^owner /, "") : ""));
  } else {
    const byPriority = /\b(first|priority|today|urgent|chase|start)\b/.test(q);
    const pr = (c) => PRIORITY[String(c[4]).toLowerCase()] ?? 9;
    const ranked = [...issues.values()].filter((c) => !/approved|done|closed/i.test(c[5]))
      .sort((a, b) => (byPriority ? pr(a) - pr(b) : 0) || Math.abs(Number(b[7])) - Math.abs(Number(a[7]))).slice(0, 3);
    for (const i of ranked) lines.push(`- ${i[0]} ${i[1]}: ${money(i[7])} across ${i[6]}, ${i[3]}${byPriority ? `, ${i[4]}` : ""}`);
    if (ranked.length) lines.push(`Next step: open ${ranked[0][0]} in Issues and work it first.`);
  }
  return lines;
}

// What changed after September, from the months column of each issue (no new numbers).
function changedSection(ctx) {
  const issues = section(ctx, "ISSUES (").map(cols).filter((c) => c.length >= 10);
  const months = (c) => String(c[9]).replace(/^months /, "");
  const fmt = (c) => `${c[0]} ${c[1]} (${c[7]}, ${c[6]}, ${c[3]})`;
  const fresh = issues.filter((c) => /october/.test(months(c)) && !/september/.test(months(c)));
  const both = issues.filter((c) => /october/.test(months(c)) && /september/.test(months(c)));
  const gone = issues.filter((c) => /september/.test(months(c)) && !/october/.test(months(c)));
  if (!fresh.length && !both.length) return { text: "", fresh, both, gone };
  const text = ["", "WHAT CHANGED AFTER SEPTEMBER (from each issue's months)", `New in October: ${fresh.map(fmt).join("; ") || "none"}`, `Still happening (September and October): ${both.map(fmt).join("; ") || "none"}`, `Seen in September but not in October: ${gone.map(fmt).join("; ") || "none"}`].join("\n");
  return { text, fresh, both, gone };
}
function unknownRefs(answer, ctx) {
  return (String(answer).match(/SEAM-\d+/g) || []).filter((r) => !/^SEAM-\d{4}$/.test(r) || !ctx.includes(`${r} |`));
}

export const askSeams = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    question: z.string().min(1).max(600),
    context: z.string().max(20000),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1600) })).max(8),
  }))
  .handler(async ({ data, context }) => {
    const changed = changedSection(data.context);
    const fullCtx = `${data.context}${changed.text}`;
    const system = `${ASK_SYSTEM}\n\nCONTEXT\n${fullCtx}`;
    const messages = [...data.history, { role: "user", content: data.question }];
    const tries = [];
    const key = nvidiaKey();
    if (key) {
      try {
        const a = normalise(AskAnswer.parse(await nemotron(key, [{ role: "system", content: system }, ...messages], 900)));
        tries.push({ ...a, model: "Nemotron" });
      } catch (e) { tries.push({ answer: "", cites: [], model: `Nemotron failed: ${String(e?.message || e).slice(0, 120)}` }); }
    }
    // Drop any line that states a number the context does not have, then judge what is left.
    const clean = () => { for (const t of tries) {
      const off = (x) => [...badNumbers(x, data.context), ...unknownRefs(x, data.context)];
      if (!t.answer || !off(t.answer).length) continue;
      t.dropped = off(t.answer).slice(0, 5);
      t.answer = t.answer.split("\n").filter((l) => !off(l).length).join("\n").trim();
    } };
    clean();
    const good = (t) => t && !!t.answer && !badNumbers(t.answer, data.context).length;
    if (!(good(tries[0]) && !weakAnswer(tries[0].answer))) {
      try {
        const r = await chat({ adapter: gatewayModel(context.getBase44()), systemPrompts: [system], messages, outputSchema: AskAnswer, agentLoopStrategy: maxIterations(1) });
        tries.push({ ...normalise(r), model: "Base44 AI" });
      } catch (e) { tries.push({ answer: "", cites: [], model: `Base44 AI failed: ${String(e?.message || e).slice(0, 120)}` }); }
      clean();
    }
    const found = tries.find((t) => good(t) && !weakAnswer(t.answer)) || [...tries].filter(good).sort((a, b) => b.answer.length - a.answer.length)[0];
    const pick = found ? { ...found } : { answer: "Here is what the findings show:", cites: [], model: "findings" };
    if (!pick.cites.length) pick.cites = contextCites(data.context);
    if (data.history.length ? pick.answer.length < 80 : weakAnswer(pick.answer)) {
      const isChange = /\b(changed?|changes|new in|october|after september|since september|fixed)\b/i.test(data.question) && changed.text;
      const changeLines = isChange ? [
        ...(changed.fresh.length ? [`- New in October: ${changed.fresh.slice(0, 4).map((c) => `${c[0]} ${c[1]} (${money(c[7])})`).join("; ")}`] : []),
        ...(changed.both.length ? [`- Still happening from September: ${changed.both.slice(0, 4).map((c) => `${c[0]} ${c[1]} (${money(c[7])})`).join("; ")}`] : []),
        ...(changed.gone.length ? [`- Not seen again in October: ${changed.gone.slice(0, 4).map((c) => `${c[0]} ${c[1]}`).join("; ")}`] : []),
        `Next step: start with ${(changed.fresh[0] || changed.both[0])[0]} in Issues.`,
      ] : null;
      const extra = (changeLines || detailLines(data.context, data.question)).filter((l) => !pick.answer.includes(l.slice(2, 40)));
      if (extra.length) { pick.answer = `${pick.answer}\n${extra.join("\n")}`; pick.model = `${pick.model} + findings`; }
    }
    pick.trace = tries.map((t) => ({ model: t.model, chars: t.answer.length, dropped: t.dropped || [] }));
    return pick;
  });
