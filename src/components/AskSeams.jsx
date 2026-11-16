// H10 — Ask Seams input, suggested questions, answer + suggested-action card.
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";

const SUGGESTED_QUESTIONS = [
  "Which customers do we owe money to?",
  "Why wasn't the Bronx Realty rent flagged?",
  "Fix the Chelsea towels",
  "What changed after the returns file?",
];

export default function AskSeams({ role = "admin", onOpenId }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  async function ask(q) {
    const text = (q || question).trim();
    if (!text) return;
    setBusy(true);
    setActionMsg("");
    setQuestion(text);
    try {
      const { data } = await base44.functions.invoke("askSeams", { question: text });
      setAnswer(data);
    } catch (e) {
      setAnswer({ answer: e?.response?.data?.error || e.message, ids: [] });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!answer?.suggested_action_id) return;
    if (role !== "admin") {
      setActionMsg("Controller only");
      return;
    }
    setBusy(true);
    try {
      await base44.functions.invoke("executeAction", { action_id: answer.suggested_action_id });
      setActionMsg("Done. Check the Ledger for the audit trail.");
      setAnswer((a) => (a ? { ...a, suggested_action_id: null } : a));
    } catch (e) {
      setActionMsg(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!answer?.suggested_action_id) return;
    setBusy(true);
    try {
      await base44.functions.invoke("rejectAction", { action_id: answer.suggested_action_id });
      setActionMsg("Suggestion rejected.");
      setAnswer((a) => (a ? { ...a, suggested_action_id: null } : a));
    } catch (e) {
      setActionMsg(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="crm-card p-5">
      <h2 className="text-base font-bold text-[#111]">Ask Seams</h2>
      <p className="mt-1 text-xs text-[#6B6B76]">Answers from checked records only. Nothing runs until you approve.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask about a customer, flag, or change…"
          className="min-h-[44px] flex-1 rounded-full border border-[#E4E4E8] bg-[#F7F7F8] px-4 text-sm"
        />
        <button type="button" disabled={busy} onClick={() => ask()} className="crm-btn-black">
          Ask
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="min-h-[40px] rounded-full bg-[#E8F6D8] px-3 text-xs font-semibold text-[#3D5C12]"
          >
            {q}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-4 rounded-2xl bg-[#F5F5F5] p-4 text-sm" role="status">
          <p className="text-[#14171F]">{answer.answer}</p>
          {answer.ids?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {answer.ids.slice(0, 12).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenId?.(id)}
                  className="min-h-[44px] rounded-2xl bg-white px-2 py-1 font-mono text-[11px] text-[#3B5BDB]"
                >
                  {id}
                </button>
              ))}
            </div>
          ) : null}
          {answer.suggested_action_id ? (
            <div className="mt-3 rounded-2xl border border-[#E2DDD2] bg-white p-3">
              <p className="text-xs text-[#5B5F68]">Suggested action</p>
              <p className="mt-1 font-medium">{answer.answer}</p>
              {answer.amount_cents ? (
                <p className="mt-1 font-mono text-xs">{fmt(answer.amount_cents)}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || role !== "admin"}
                  title={role !== "admin" ? "Controller only" : undefined}
                  onClick={approve}
                  className="min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm text-white disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={reject}
                  className="min-h-[44px] rounded-2xl border border-[#E2DDD2] px-4 text-sm"
                >
                  Reject
                </button>
              </div>
              {role !== "admin" ? <p className="mt-2 text-xs text-[#8A5A00]">Controller only</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {actionMsg ? <p className="mt-2 text-xs text-[#5B5F68]">{actionMsg}</p> : null}
    </section>
  );
}
