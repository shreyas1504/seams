// Ledger: all AuditEvents newest first, filter by action/entity, Undo on reversible (admin).
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { useEntity } from "@/lib/useEntity";
import { seamsActorName, seamsAuditSentence } from "@/components/auditPresentation.js";
import { seamsNotifyFeedback } from "@/components/InteractionFeedback.jsx";
import { displayText } from "@/lib/displayText.js";

export default function Ledger({ role = "admin" }) {
  const [events, reload] = useEntity("AuditEvent");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);

  const sorted = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.created_at || b.created_date || 0) - Date.parse(a.created_at || a.created_date || 0)),
    [events],
  );
  const actions = useMemo(() => [...new Set(sorted.map((e) => e.action).filter(Boolean))].sort(), [sorted]);
  const entities = useMemo(() => [...new Set(sorted.map((e) => e.entity_type).filter(Boolean))].sort(), [sorted]);
  const filtered = sorted.filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (entityFilter && e.entity_type !== entityFilter) return false;
    return true;
  });

  const undo = async (id) => {
    setErr("");
    setBusy(id);
    try {
      await base44.functions.invoke("undoAction", { audit_event_id: id });
      announceSeamsDataChanged();
      reload();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
      seamsNotifyFeedback({ error: true, message: e?.response?.data?.error || e.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="brief-label">A record of every decision</p>
        <h1 className="font-display text-[32px] font-medium mt-2">Activity</h1>
        <p className="text-sm text-[#6B635A]">Every change, newest first</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={actionFilter}
          aria-label="Filter by action"
          onChange={(e) => setActionFilter(e.target.value)}
          className="min-h-[44px] rounded-full border border-[#E4E4E8] bg-white px-3 text-sm font-semibold"
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={entityFilter}
          aria-label="Filter by entity"
          onChange={(e) => setEntityFilter(e.target.value)}
          className="min-h-[44px] rounded-full border border-[#E4E4E8] bg-white px-3 text-sm font-semibold"
        >
          <option value="">All entities</option>
          {entities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {err ? <p className="text-sm font-semibold text-[#C22A25]">{err}</p> : null}

      <ul className="activity-timeline">
        {filtered.map((ev) => (
          <li key={ev.id} className="activity-event card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#111]">
                  {seamsAuditSentence(ev)}
                  {ev.undone ? (
                    <span className="crm-tag crm-tag-warn ml-2">undone</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-[#6B6B76]">
                  {seamsActorName(ev.actor_email)} · {ev.actor_role === "admin" ? "Controller" : ev.actor_role === "user" ? "Analyst" : ev.actor_role}
                  {ev.entity_type ? ` · ${ev.entity_type}` : ""}
                </p>
                {ev.reason ? <p className="mt-1 text-xs text-[#111]">{displayText(ev.reason)}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] text-[#6B6B76]">{(ev.created_at || ev.created_date || "").slice(0, 19)}</p>
                {ev.reversible && !ev.undone ? (
                  <button
                    type="button"
                    disabled={role !== "admin" || busy === ev.id}
                    onClick={() => undo(ev.id)}
                    className="crm-btn-black mt-2 !text-xs disabled:opacity-40"
                    title={role !== "admin" ? "Controller only" : "Undo"}
                  >
                    {role !== "admin" ? "Controller only" : busy === ev.id ? "Undoing…" : "Undo"}
                  </button>
                ) : null}
                {ev.reversible && !ev.undone && role !== "admin" ? <p className="text-xs text-[#6B635A] mt-1">Controller approval needed</p> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!filtered.length ? <p className="card p-8 text-[#6B635A] text-center">No activity matches these filters.</p> : null}
    </div>
  );
}
