import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { seamsNotifyFeedback, seamsNotifySent, useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";
import { loadDemoData } from "@/actions/loadDemoData.js";
import { paletteApprovalBlock } from "@/components/paletteActionGate.js";

const PALETTE_EXAMPLE_QUESTIONS = ["Which customers do we owe money to?", "Why wasn't the Bronx Realty rent flagged?", "Fix the Chelsea towels", "What changed after the returns file?"];

export default function CommandPalette({ role, onClose, onNavigate, onUpload, initialQuery = "", showRuled = false }) {
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
        const [record, asked] = await Promise.all([
          base44.functions.invoke("lookupRecord", {id:query.trim()}),
          base44.functions.invoke("askSeams", {question:query.trim()}),
        ]);
        let blocked = "";
        if (asked.data.suggested_action_id) {
          const suggestion = await base44.entities.SuggestedAction.get(asked.data.suggested_action_id);
          if (suggestion?.action_type === "send_correction") blocked = paletteApprovalBlock(suggestion, await base44.entities.Flag.filter({party:suggestion.params?.party}));
        }
        if (token === generation.current) { setLookup(record.data); setAnswer(asked.data); setActionBlocked(blocked); }
      } catch (e) { if(token===generation.current) setError(e?.response?.data?.error || e.message); }
      finally { if(token===generation.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);
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
      <div className="palette-search"><input ref={input} value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Look up a record or ask Seams" placeholder="Look up a record, ask, or act…" /><button aria-label="Close command palette" className="chip chip-neutral" onClick={onClose}>esc</button></div>
      <div className="palette-results">
        <h2 className="brief-label mb-2">Records</h2>
        {busy ? <p className="text-xs text-muted" role="status">Looking through checked records…</p> : lookup?.kind==="flagged" ? lookup.flags.map((f)=><button data-command key={f.stable_key} className="palette-record" onClick={()=>openFlag(f)}>Flagged: {f.title} · <span className="money">{fmt(f.amount_cents)}</span></button>) : lookup?.kind==="ruled_out" ? lookup.ruled.map((r,i)=><p className="palette-record" key={i}>Ruled out: {r.reason}</p>) : query.trim() && lookup ? <p className="palette-record">Not found in any of the 4 systems</p> : <p className="text-xs text-muted">Search a business ID such as INV-5078 or SH-3058.</p>}
        <h2 className="brief-label mt-5 mb-2">Ask Seams</h2>
        {!query.trim() ? <div className="grid gap-1">{PALETTE_EXAMPLE_QUESTIONS.map(q=><button data-command className="palette-action" key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div> : answer ? <div className="card p-3 text-[13px]">
          <p>{answer.answer}</p>
          <div className="flex flex-wrap gap-1 mt-2">{[...new Set(answer.ids||[])].map(id=><button data-command className="record-chip" key={id} onClick={()=>openRecord(id)}>{id}</button>)}</div>
          {answer.suggested_action_id ? <div className="flex gap-2 mt-3"><button data-command className="fix-pill" disabled={working||role!=="admin"||Boolean(actionBlocked)} onClick={()=>act(true)}>{working?"Sending…":"Approve"}</button><button data-command className="seam-chip" disabled={working} onClick={()=>act(false)}>Reject</button></div> : null}
          {answer.suggested_action_id && actionBlocked ? <p className="text-xs text-muted mt-2">{actionBlocked}</p> : null}
          {answer.suggested_action_id && role!=="admin" ? <p className="text-xs text-muted mt-2">Controller approval needed</p> : null}
        </div> : null}
        {error ? <p role="status" className="text-[12px] text-overdue mt-2">{error}</p> : null}
        <h2 className="brief-label mt-5 mb-2">Actions</h2>
        <button data-command className="palette-action" onClick={()=>{onClose();onUpload();}}>Upload new data <kbd>U</kbd></button>
        <button data-command className="palette-action" disabled={working||role!=="admin"} onClick={load}>{working?"Working…":"Load demo data"} <kbd>D</kbd></button>
        {role!=="admin" ? <p className="text-xs text-muted">Controller approval needed to load demo data</p> : null}
        <button data-command className="palette-action" onClick={async()=>setRuled(await base44.entities.RuledOut.list(undefined,5000))}>Show look-alikes ruled out <kbd>R</kbd></button>
        {ruled ? <div className="mt-2"><p className="font-display text-lg">{ruled.length} look-alikes ruled out</p>{ruled.map((r,i)=><p className="text-xs text-muted border-t border-line py-2" key={r.id||i}>{r.reason}</p>)}</div> : null}
      </div>
      <footer className="palette-footer">Numbers come from records. AI only routes your question.</footer>
    </section>
  </div>;
}
