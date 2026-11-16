import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";

export function seamsNotifyFeedback(detail) {
  window.dispatchEvent(new CustomEvent("seams:feedback", { detail }));
}

export async function seamsNotifySent(data) {
  const letter = await base44.entities.Letter.get(data.letter_id);
  const events = await base44.entities.AuditEvent.filter({ entity_type: "Letter", entity_id: data.letter_id });
  seamsNotifyFeedback({ message: `Sent to ${letter.party} · ${fmt(letter.frozen_total_cents)}.`, auditId: events.find((e) => e.action === "send_letter")?.id });
}

export function useSeamsDrawerLifecycle(onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const timer = setTimeout(() => document.querySelector("[role=dialog] button")?.focus(), 0);
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current?.(); }
      if (e.key === "Tab") {
        const nodes = [...(document.querySelector("[role=dialog]")?.querySelectorAll('button:not(:disabled),input,select,textarea,[tabindex="0"]') || [])];
        if (!nodes.length) return;
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", key); previous?.focus?.(); };
  }, []);
}

export function SeamsSkeleton() {
  return <div className="seams-skeleton-grid" role="status" aria-label="Loading findings" aria-busy="true">
    <div className="seams-skeleton" style={{ height: 260 }} />
    <div className="seams-skeleton" style={{ height: 330 }} />
    <div>{[0, 1, 2, 3].map((n) => <div key={n} className="seams-skeleton" style={{ height: 78, marginBottom: 10 }} />)}</div>
    <div className="seams-skeleton" style={{ height: 360 }} />
    <span className="sr-only">Loading findings…</span>
  </div>;
}

export default function InteractionFeedback() {
  const [toast, setToast] = useState(null);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(8000);
  const [shortcuts, setShortcuts] = useState(false);
  const returnFocus = useRef(null);
  useEffect(() => {
    const notify = (e) => { setToast(e.detail); setPaused(false); };
    const key = (e) => {
      if (e.key === "Escape") { setShortcuts(false); returnFocus.current?.focus?.(); }
      if (e.target.closest?.("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "?" && !document.querySelector("[role=dialog]")) { returnFocus.current = document.activeElement; setShortcuts(true); }
    };
    window.addEventListener("seams:feedback", notify);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("seams:feedback", notify); window.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => { remaining.current = 8000; }, [toast]);
  useEffect(() => {
    if (!toast || toast.error || paused) return;
    const start = Date.now();
    const id = setTimeout(() => setToast(null), remaining.current);
    return () => { clearTimeout(id); remaining.current = Math.max(0, remaining.current - (Date.now() - start)); };
  }, [toast, paused]);
  const undo = async () => {
    setPaused(true);
    try {
      await base44.functions.invoke("undoAction", { audit_event_id: toast.auditId });
      announceSeamsDataChanged();
      setToast(null);
    } catch (e) {
      setToast({ error: true, message: e?.response?.data?.error || e.message });
    }
  };
  return <>
    <div className="seams-toast-region" aria-live="polite" aria-atomic="true">
      {toast ? <div className={`seams-toast${toast.error ? " is-error" : ""}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <span>{toast.message}</span>
        {toast.auditId ? <button type="button" onClick={undo}>Undo</button> : null}
        <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button>
      </div> : null}
    </div>
    {shortcuts ? <div className="seams-shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2 className="font-display text-[22px]">Keyboard shortcuts</h2>
      <p>J / K — Next / previous finding</p><p>Enter — Open selected fix</p><p>Esc — Close</p><p>⌘K / Ctrl+K — Search</p><p>? — Shortcuts</p>
      <button autoFocus className="fix-pill mt-4" onClick={() => { setShortcuts(false); returnFocus.current?.focus?.(); }}>Close shortcuts</button>
    </div> : null}
  </>;
}
