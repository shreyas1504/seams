import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { seamsNotifyFeedback, seamsNotifySent, useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";
import { loadDemoData } from "@/actions/loadDemoData.js";
import { paletteApprovalBlock } from "@/components/paletteActionGate.js";
import { displayText } from "@/lib/displayText.js";

const PALETTE_EXAMPLE_QUESTIONS = ["What did we lose this month?", "Which customer owes the most?", "Which customers do we owe money to?", "What changed after the returns file?"];

export default function CommandPalette({ role, onClose, onNavigate, onUpload, initialQuery = "", autoAsk = false, showRuled = false }) {
  useSeamsDrawerLifecycle(onClose);
  const { setSelectedSeam, setSelectedFlagKey } = useSelectedSeam();
  const [query, setQuery] = useState(initialQuery);
  const [lookup, setLookup] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [ruled, setRuled] = useState(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [actionBlocked, setActionBlocked] = useState("");
  const [hasData, setHasData] = useState(false);
  useEffect(() => {
    base44.entities.Invoice.list(undefined, 1).then((r) => setHasData((r || []).length > 0)).catch(() => {});
  }, []);
  const root = useRef(null);
  const input = useRef(null);
  const generation = useRef(0);
  const actionLock = useRef(false);
  useEffect(() => { const id = setTimeout(() => input.current?.focus(), 20); return () => clearTimeout(id); }, []);
  useEffect(() => {
    if (showRuled) base44.entities.RuledOut.list(undefined,5000).then(setRuled);
  }, [showRuled]);
  useEffect(() => {
    const token = ++generation.current;
    setCursor(-1); setError(""); setLookup(null); setAnswer(null); setActionBlocked("");
    if (!query.trim()) { setBusy(false); return; }
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        // While typing: record lookup + a rules-only preview. No AI call and nothing stored per keystroke.
        const [record, asked] = await Promise.all([
          base44.functions.invoke("lookupRecord", {id:query.trim()}),
          base44.functions.invoke("askSeams", {question:query.trim(), dry_run:true, no_ai:true}),
        ]);
        if (token === generation.current) { setLookup(record.data); setAnswer(asked.data); setActionBlocked(""); }
      } catch (e) { if(token===generation.current) setError(e?.response?.data?.error || e.message); }
      finally { if(token===generation.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);
  // Enter: ask in full (the AI may route unusual wording). Still a preview: nothing is stored.
  const askFull = async () => {
    const q = query.trim();
    if (!q || actionLock.current) return;
    const token = ++generation.current;
    setBusy(true); setError("");
    try {
      const { data } = await base44.functions.invoke("askSeams", { question: q, dry_run: true });
      if (token === generation.current) setAnswer({ ...data, asked_full: true });
    } catch (e) { if (token === generation.current) setError(e?.response?.data?.error || e.message); }
    finally { if (token === generation.current) setBusy(false); }
  };
  // "Draft this fix": only now is a proposed SuggestedAction stored, and it still waits for Approve.
  const draftFix = async () => {
    const q = query.trim();
    if (!q || actionLock.current) return;
    actionLock.current = true; setWorking(true); setError("");
    try {
      const { data } = await base44.functions.invoke("askSeams", { question: q });
      let blocked = "";
      if (data.suggested_action_id) {
        const suggestion = await base44.entities.SuggestedAction.get(data.suggested_action_id);
        if (suggestion?.action_type === "send_correction") blocked = paletteApprovalBlock(suggestion, await base44.entities.Flag.filter({party:suggestion.params?.party}));
      }
      setAnswer({ ...data, asked_full: true }); setActionBlocked(blocked);
    } catch (e) { setError(e?.response?.data?.error || e.message); }
    finally { actionLock.current = false; setWorking(false); }
  };
  // Opened from the Today "Ask Seams" bar: ask in full straight away.
  useEffect(() => {
    if (!autoAsk || !initialQuery) return;
    const id = setTimeout(() => askFull(), 400);
    return () => clearTimeout(id);
  }, []);
  const openFlag = (flag) => { setSelectedSeam(flag.seam); setSelectedFlagKey(flag.stable_key); onNavigate("Today"); onClose(); };
  const openRecord = async (id) => {
    try {
      const {data} = await base44.functions.invoke("lookupRecord",{id});
      if (data.flags?.length) openFlag(data.flags[0]);
      else { setQuery(id); setLookup(data); }
    } catch(e) { setError(e?.response?.data?.error || e.message); }
  };
  const act = async (approve) => {
    if (actionLock.current || !answer?.suggested_action_id) return;
    if (approve && actionBlocked) return;
    actionLock.current = true; setWorking(true); setError("");
    try {
      const { data } = await base44.functions.invoke(approve ? "executeAction" : "rejectAction", {action_id:answer.suggested_action_id});
      if (approve) {
        announceSeamsDataChanged();
        if (data.result?.letter_id) void seamsNotifySent(data.result);
        else seamsNotifyFeedback({message:data.result?.pending_second ? "Waiting for a second Controller" : "Action approved."});
      }
      setAnswer((a)=>({...a,suggested_action_id:null}));
      setError(approve ? "Approved. See Activity for the audit trail." : "Suggestion rejected.");
    } catch(e) { const message=e?.response?.data?.error || e.message; setError(message); seamsNotifyFeedback({error:true,message}); }
    finally { actionLock.current=false; setWorking(false); }
  };
  const load = async () => {
    if (actionLock.current) return;
    actionLock.current=true;setWorking(true);
    try { await loadDemoData(); onNavigate("Today"); onClose(); }
    catch(e){setError(e?.response?.data?.error || e.message);}
    finally {actionLock.current=false;setWorking(false);}
  };
  const keys = (e) => {
    if (!["ArrowDown","ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const targets=[...root.current.querySelectorAll("[data-command]:not(:disabled)")];
    const next=Math.max(0,Math.min(targets.length-1,cursor+(e.key==="ArrowDown"?1:-1)));
    setCursor(next); targets[next]?.focus();
  };
  return <div className="palette-overlay" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={root} role="dialog" aria-modal="true" aria-label="Look up, ask, act" className="command-palette card" onKeyDown={keys}>
      <div className="palette-search"><input ref={input} value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key === "Enter") { e.preventDefault(); askFull(); } }} aria-label="Look up a record or ask Seams" placeholder="Ask about the money, look up a record, or say “fix Greenpoint”…" /><button aria-label="Close command palette" className="chip chip-neutral" onClick={onClose}>esc</button></div>
      <div className="palette-results">
        <h2 className="brief-label mb-2">Records</h2>
        {busy ? <p className="text-xs text-[#6B635A]" role="status">Looking through checked records…</p> : lookup?.kind==="flagged" ? lookup.flags.map((f)=><button data-command key={f.stable_key} className="palette-record" onClick={()=>openFlag(f)}>Flagged: {displayText(f.title)} · <span className="money">{fmt(f.amount_cents)}</span></button>) : lookup?.kind==="ruled_out" ? lookup.ruled.map((r,i)=><p className="palette-record" key={i}>Ruled out: {displayText(r.reason)}</p>) : query.trim() && lookup && /\d/.test(query) && !/\s/.test(query.trim()) ? <p className="palette-record">Not found in any loaded system</p> : query.trim() && lookup ? <p className="text-xs text-[#6B635A]">No record ID in this question.</p> : <p className="text-xs text-[#6B635A]">Search a business ID such as INV-5078 or SH-3058.</p>}
        <h2 className="brief-label mt-5 mb-2">Ask Seams</h2>
        {!query.trim() ? <div className="grid gap-1">{PALETTE_EXAMPLE_QUESTIONS.map(q=><button data-command className="palette-action" key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div> : answer ? <div className="card p-3 text-[13px]">
          <p>{displayText(answer.answer)}</p>
          {answer.refused && !answer.asked_full ? <p className="text-xs text-[#6B635A] mt-2">Press Enter to ask Seams in full.</p> : null}
          {answer.routed_by === "nemotron" ? <p className="text-[11px] text-[#0F766E] mt-2">Understood by NVIDIA Nemotron · numbers computed from records</p> : answer.routed_by === "base44-ai" ? <p className="text-[11px] text-[#6B635A] mt-2">Understood by Base44 AI · numbers computed from records</p> : null}
          {answer.would_propose ? <div className="flex gap-2 mt-3"><button data-command className="fix-pill" disabled={working||role!=="admin"} onClick={draftFix}>{working?"Drafting…":"Draft this fix"}</button><span className="text-xs text-[#6B635A] self-center">Nothing is sent until a Controller approves.</span></div> : null}
          <div className="flex flex-wrap gap-1 mt-2">{[...new Set(answer.ids||[])].map(id=><button data-command className="record-chip" key={id} onClick={()=>openRecord(id)}>{id}</button>)}</div>
          {answer.suggested_action_id ? <div className="flex gap-2 mt-3"><button data-command className="fix-pill" disabled={working||role!=="admin"||Boolean(actionBlocked)} onClick={()=>act(true)}>{working?"Sending…":"Approve"}</button><button data-command className="seam-chip" disabled={working} onClick={()=>act(false)}>Reject</button></div> : null}
          {answer.suggested_action_id && actionBlocked ? <p className="text-xs text-[#6B635A] mt-2">{actionBlocked}</p> : null}
          {answer.suggested_action_id && role!=="admin" ? <p className="text-xs text-[#6B635A] mt-2">Controller approval needed</p> : null}
        </div> : null}
        {error ? <p role="status" className="text-[12px] text-[#9F1239] mt-2">{error}</p> : null}
        <h2 className="brief-label mt-5 mb-2">Actions</h2>
        <button data-command className="palette-action" onClick={()=>{onClose();onUpload();}}>Upload new data <kbd>U</kbd></button>
        {hasData
          ? <button data-command className="palette-action" disabled={role!=="admin"} onClick={()=>{onNavigate("Data");onClose();}}>Reset demo data (on the Data page) <kbd>D</kbd></button>
          : <button data-command className="palette-action" disabled={working||role!=="admin"} onClick={load}>{working?"Working…":"Load demo data"} <kbd>D</kbd></button>}
        {role!=="admin" ? <p className="text-xs text-[#6B635A]">Controller approval needed to load demo data</p> : null}
        <button data-command className="palette-action" onClick={async()=>setRuled(await base44.entities.RuledOut.list(undefined,5000))}>Show look-alikes ruled out <kbd>R</kbd></button>
        {ruled ? <div className="mt-2"><p className="font-display text-lg">{ruled.length} look-alikes ruled out</p>{ruled.map((r,i)=><p className="text-xs text-[#6B635A] border-t border-[#ECE4D8] py-2" key={r.id||i}>{displayText(r.reason)}</p>)}</div> : null}
      </div>
      <footer className="palette-footer">Numbers come from records. AI only routes your question.</footer>
    </section>
  </div>;
}
