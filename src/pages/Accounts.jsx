import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { rankParties, buildLetterDraft, DEFAULT_SETTINGS, fmt } from "@/lib/engine/engine.js";
import { onSeamsDataChanged, announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { seamLabel, seamTint, SYSTEM_TINT } from "@/components/systems.js";
import { fixTitle } from "@/components/fixProof.js";
import SeamsSheet from "@/components/SeamsSheet.jsx";
import LetterDrawer from "@/components/LetterDrawer.jsx";
import RefundDrawer from "@/components/RefundDrawer.jsx";
import { seamsAuditSentence } from "@/components/auditPresentation.js";

export default function Accounts({ role = "admin", onOpenFlag }) {
  const [flags, reloadFlags] = useEntity("Flag");
  const [actions, reloadActions] = useEntity("SuggestedAction");
  const [contracts] = useEntity("Contract");
  const [settings] = useEntity("Setting");
  const [letters, reloadLetters] = useEntity("Letter");
  const [audits, reloadAudits] = useEntity("AuditEvent");
  const [tab, setTab] = useState("All");
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);
  useEffect(() => onSeamsDataChanged(() => { reloadFlags(); reloadActions(); reloadLetters(); reloadAudits(); }), [reloadFlags, reloadActions, reloadLetters, reloadAudits]);
  const rows = useMemo(() => {
    const relevant = flags.filter((f) => ["open", "sent", "disputed", "needs_review", "recovered", "credited"].includes(f.status || "open"));
    const ranked = rankParties(relevant);
    return [...ranked.customers, ...ranked.vendors].map((p) => {
      const open = p.flags.filter((f) => (f.status || "open") === "open");
      const review = p.flags.filter((f) => f.status === "needs_review");
      const kind = p.lane === "vendor" ? "vendor" : !open.length && review.length ? "correction" : "customer";
      const draft = buildLetterDraft({ party: p.party, kind, flags, contracts, rule_enabled: { ...DEFAULT_SETTINGS.rule_enabled, ...(settings[0]?.rule_enabled || {}) } });
      const sent = !draft.flag_keys.length && p.flags.some((f) => ["sent", "disputed", "recovered", "credited"].includes(f.status));
      const latest = letters.filter((l) => l.party === p.party).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0];
      const total = sent ? latest?.frozen_total_cents ?? 0 : draft.total_cents;
      const pending = actions.find((a) => a.status === "pending_second" && a.params?.party === p.party && a.params?.kind === kind);
      const shownFlags = sent ? p.flags.filter((f) => (latest?.flag_keys || []).includes(f.stable_key)) : p.flags.filter((f) => draft.flag_keys.includes(f.stable_key));
      return { ...p, kind, total, sent, pending, draft, shownFlags, status: sent ? "Sent" : pending ? "Needs approval" : total < 0 ? "Credit owed" : "Open" };
    });
  }, [flags, actions, contracts, settings, letters]);
  const shown = rows.filter((p) => tab === "Sent" ? p.sent : !p.sent && (tab === "All" || (tab === "Customers" ? p.lane === "customer" : p.lane === "vendor")));
  const party = rows.find((p) => p.party === selected);
  useEffect(() => { setCursor(0); }, [tab]);
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input,textarea,select,[contenteditable=true]") || document.querySelector("[role=dialog]") || e.metaKey || e.ctrlKey) return;
      if (["j", "k"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const n = Math.max(0, Math.min(shown.length - 1, cursor + (e.key.toLowerCase() === "j" ? 1 : -1)));
        setCursor(n); listRef.current?.querySelectorAll(".account-row")[n]?.focus();
      } else if (e.key === "Enter" && shown[cursor]) { e.preventDefault(); setSelected(shown[cursor].party); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shown, cursor]);
  const afterSend = (data) => { setDrawer(false); setSelected(null); if (!data?.dismissed) setTab("Sent"); announceSeamsDataChanged(); };
  const timeline = party ? audits.filter((a) => a.after?.party === party.party || party.flags.some((f) => a.entity_type === "Flag" && a.entity_id === f.id) || letters.some((l) => l.party === party.party && l.id === a.entity_id) || actions.some((s) => s.params?.party === party.party && s.id === a.entity_id)).sort((a,b) => String(b.created_at || b.created_date).localeCompare(String(a.created_at || a.created_date))) : [];
  const threshold = settings[0]?.four_eyes_threshold_cents ?? 500000;
  const primary = party ? party.pending ? `Request approval · ${fmt(party.total)}` : Math.abs(party.total) >= threshold ? `Request approval · ${fmt(party.total)}` : party.lane === "vendor" ? `Request refund ${fmt(party.total)}` : `Settle ${fmt(party.total)}` : "";
  return <div className="space-y-5">
    <header><p className="brief-label">Every party · one letter total</p><h1 className="font-display text-[32px] font-medium mt-2">Accounts</h1></header>
    <div className="segmented w-fit" role="group" aria-label="Account filters">{["All","Customers","Vendors","Sent"].map((t) => <button key={t} className="segmented-option" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
    <div ref={listRef} className="card divide-y divide-line" aria-label="Accounts list">
      {!shown.length ? <p className="p-8 text-muted text-center">No accounts in this view.</p> : shown.map((p, i) => <button key={p.party} className="account-row" onFocus={() => setCursor(i)} onClick={() => setSelected(p.party)}>
        <span className="account-initials" style={{background:seamTint(p.flags[0]?.seam).bg,color:seamTint(p.flags[0]?.seam).ink}}>{p.party.split(" ").slice(0,2).map((s) => s[0]).join("")}</span>
        <span className="account-name"><strong>{p.party}</strong><small>{p.shownFlags.length} issues</small><span className="flex flex-wrap gap-1 mt-1">{[...new Set(p.shownFlags.map((f) => f.seam))].map((s) => <span key={s} className="account-seam" style={{background:seamTint(s).bg,color:seamTint(s).ink}}>{seamLabel(s)}</span>)}</span></span>
        <span className={`chip ${p.sent ? "chip-credit" : p.pending ? "account-pending" : p.total < 0 ? "chip-credit" : "chip-neutral"}`}>{p.status}</span>
        <span className={`money account-total ${p.total < 0 ? "text-credit" : "text-ink"}`}>{fmt(p.total)}</span>
      </button>)}
    </div>
    {party && !drawer ? <SeamsSheet title={party.party} eyebrow="Account" onClose={() => setSelected(null)}>
      <div className="p-5">
        <p className="money text-[32px] font-semibold">{fmt(party.total)}</p>
        <div className="account-breakdown">{[["Owed to us","recoverable"],["Overdue","overdue"],["We owe","credit_owed"]].map(([label,bucket]) => <div key={bucket}><p>{label}</p><strong className="money">{fmt(party.shownFlags.filter((f)=>f.bucket===bucket).reduce((s,f)=>s+f.amount_cents,0))}</strong></div>)}</div>
        <button className="btn-forest w-full justify-center mt-4" disabled={party.sent || !party.draft.flag_keys.length} onClick={() => setDrawer(true)}>{primary}</button>
        {party.sent || !party.draft.flag_keys.length ? <p className="text-xs text-muted mt-2">Nothing left to send</p> : null}
        <h3 className="font-display text-xl mt-7 mb-3">Issues · {party.shownFlags.length}</h3>
        <div className="space-y-3">{party.shownFlags.map((f) => <article key={f.stable_key} className="card p-3">
          <div className="flex justify-between gap-3"><strong className="text-[13px]">{fixTitle(f)}</strong><span className={`money text-[13px] ${f.bucket==="credit_owed"?"text-credit":"text-owed"}`}>{fmt(f.amount_cents)}</span></div>
          <p className="text-xs text-muted mt-1">{f.why}</p>
          <div className="flex flex-wrap gap-1 mt-2">{(f.evidence || []).filter((e)=>e.id&&e.id!=="—").map((e,i)=><button key={i} className="record-chip" style={{background:SYSTEM_TINT[e.system]?.bg,color:SYSTEM_TINT[e.system]?.ink}} onClick={()=>onOpenFlag(f)}>{e.id}</button>)}</div>
        </article>)}</div>
        <h3 className="font-display text-xl mt-7 mb-3">Activity</h3>
        <ol className="mini-timeline">{timeline.map((e)=><li key={e.id}><p>{seamsAuditSentence(e)}</p><time>{new Date(e.created_at||e.created_date).toLocaleString()}</time></li>)}</ol>
        {!timeline.length ? <p className="text-xs text-muted">No activity for this account yet.</p> : null}
      </div>
    </SeamsSheet> : null}
    {party && drawer ? party.lane === "vendor" ? <RefundDrawer party={party.party} role={role} pendingAction={party.pending?.id} onClose={()=>setDrawer(false)} onSent={afterSend} onPending={()=>announceSeamsDataChanged()} /> : <LetterDrawer party={party.party} kind={party.kind} role={role} pendingAction={party.pending?.id} onClose={()=>setDrawer(false)} onSent={afterSend} onPending={()=>announceSeamsDataChanged()} /> : null}
  </div>;
}
