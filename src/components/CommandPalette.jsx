// Ask Seams: a chat over the loaded findings. The AI (Nemotron or Base44 AI, server side) reads only
// the totals, the issue list and the findings that match the question; every number it states is
// checked against that context. Without AI, answers come from code over the same findings.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";
import { displayText } from "@/lib/displayText.js";
import { useKitFlags, kitAsk } from "@/lib/kitData.js";
import { kitAskContext, kitCheckChat, kitIssues } from "@/lib/kitIssues.js";
import { issOpenRef } from "@/pages/KitIssues.jsx";

function askSuggestions(flags) {
  const issues = kitIssues(flags);
  const top = issues.find((i) => i.cents > 0);
  const bank = issues.find((i) => /bank account/i.test(i.rule));
  const owe = issues.find((i) => i.cents < 0);
  const s = ["Where are we losing the most money?", "What changed in October?", "What should Dana do first today?"];
  if (bank) s.push(`Why is ${bank.rows[0].party} on hold?`);
  if (top) s.push(`Explain ${top.ref}`);
  if (owe) s.push("Which customers do we owe credits to?");
  s.push("Write Frank's Monday summary in 3 lines");
  return s.slice(0, 6);
}

function AskBubble({ m, onRef }) {
  if (m.role === "user") return <div className="ask-msg is-user"><p>{m.text}</p></div>;
  return (
    <div className="ask-msg is-bot">
      {m.pending ? <p className="ask-typing" role="status">Reading the findings…</p> : (
        <>
          <div className="ask-text">{String(m.text).split(/\n+/).map((line, i) => <p key={i}>{displayText(line)}</p>)}</div>
          {m.refs?.length ? <div className="mt-2 flex flex-wrap gap-1">{m.refs.map((r) => <button key={r} type="button" className="record-chip" onClick={() => onRef(r)}>{r}</button>)}</div> : null}
          <p className="ask-meta">{m.source === "ai" ? `AI answer${m.model ? ` · ${m.model}` : ""} · numbers checked against findings.csv` : m.source === "checked-out" ? "AI answer had a number not in the findings, so this answer comes from code" : "Answer from code over findings.csv"}</p>
        </>
      )}
    </div>
  );
}

export default function CommandPalette({ onClose, onNavigate, initialQuery = "", autoAsk = false }) {
  useSeamsDrawerLifecycle(onClose);
  const { setSelectedSeam, setSelectedFlagKey } = useSelectedSeam();
  const [flags] = useKitFlags();
  const [input, setInput] = useState(autoAsk ? "" : initialQuery);
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const field = useRef(null);
  const asked = useRef(false);
  const ai = globalThis.__seamsAsk;
  const suggestions = useMemo(() => askSuggestions(flags), [flags]);

  useEffect(() => { const id = setTimeout(() => field.current?.focus(), 30); return () => clearTimeout(id); }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (autoAsk && initialQuery && flags.length && !asked.current) { asked.current = true; send(initialQuery); }
  }, [flags.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRef = (r) => {
    if (/^SEAM-\d{4}$/.test(r)) { issOpenRef(r); onNavigate("Issues"); onClose(); return; }
    const hit = flags.find((f) => f.stable_key === r || f.ids.some((x) => String(x) === r));
    if (hit) { setSelectedSeam("__all"); setSelectedFlagKey(hit.stable_key); onNavigate("Today"); onClose(); }
  };

  async function send(text) {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setInput("");
    const history = msgs.filter((m) => !m.pending).slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text).slice(0, 1500) }));
    setMsgs((ms) => [...ms, { role: "user", text: q }, { role: "bot", pending: true }]);
    setBusy(true);
    const codeAnswer = () => {
      const a = kitAsk(q, flags);
      return { text: a?.answer || "I couldn't find that in the findings. Try a customer, supplier, record ID or an issue like SEAM-1234.", refs: [...new Set(a?.ids || [])].slice(0, 8) };
    };
    let reply;
    if (ai) {
      try {
        const ctx = kitAskContext(q, flags);
        const raw = await ai({ question: q, context: ctx.text, history });
        const ok = kitCheckChat(raw, ctx);
        reply = ok && !ok.rejected ? { text: ok.answer, refs: ok.refs, source: "ai", model: ok.model } : { ...codeAnswer(), source: "checked-out" };
      } catch {
        reply = { ...codeAnswer(), source: "code" };
      }
    } else {
      reply = { ...codeAnswer(), source: "code" };
    }
    setMsgs((ms) => [...ms.slice(0, -1), { role: "bot", ...reply }]);
    setBusy(false);
  }

  return (
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Ask Seams" className="command-palette card ask-panel">
        <header className="ask-head">
          <div>
            <p className="font-display text-[17px] font-semibold text-[#1C1917]">Ask Seams</p>
            <p className="text-[11.5px] text-[#6B635A]">{ai ? "AI over your findings · every number is checked" : "Answers from the findings · AI runs in the Base44 app"}</p>
          </div>
          <div className="flex items-center gap-2">
            {msgs.length ? <button type="button" className="fix-quiet" onClick={() => setMsgs([])}>New chat</button> : null}
            <button type="button" aria-label="Close Ask Seams" className="chip chip-neutral" onClick={onClose}>esc</button>
          </div>
        </header>
        <div ref={box} className="ask-thread" aria-live="polite">
          {!msgs.length ? (
            <div className="ask-empty">
              <p className="text-[13px] text-[#44403C]">Ask anything about the {flags.length} findings: a customer or supplier, a record ID, an issue (SEAM-…), what changed, or what to do first.</p>
              <div className="mt-3 grid gap-1.5">
                {suggestions.map((s) => <button key={s} type="button" className="palette-action" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          ) : msgs.map((m, i) => <AskBubble key={i} m={m} onRef={openRef} />)}
        </div>
        <form className="ask-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} placeholder={msgs.length ? "Ask a follow-up…" : "e.g. Why is Raritan on hold?"} aria-label="Ask Seams a question" disabled={!flags.length} />
          <button type="submit" className="fix-pill" disabled={busy || !input.trim()}>{busy ? "…" : "Ask"}</button>
        </form>
        <footer className="palette-footer">AI explains; amounts come only from findings.csv. Nothing is sent or changed from this chat.</footer>
      </section>
    </div>
  );
}
