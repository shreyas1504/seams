// Ledger: all AuditEvents newest first, filter by action/entity, Undo on reversible (admin).
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { useEntity } from "@/lib/useEntity";

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
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111]">Ledger</h1>
        <p className="text-sm text-[#6B6B76]">Every change, newest first</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="min-h-[44px] rounded-full border border-[#E4E4E8] bg-white px-3 text-sm font-semibold"
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="min-h-[44px] rounded-full border border-[#E4E4E8] bg-white px-3 text-sm font-semibold"
        >
          <option value="">All entities</option>
          {entities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {err ? <p className="text-sm font-semibold text-[#C22A25]">{err}</p> : null}

      <ul className="space-y-2">
        {filtered.map((ev) => (
          <li key={ev.id} className="crm-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#111]">
                  {ev.action}
                  {ev.undone ? (
                    <span className="crm-tag crm-tag-warn ml-2">undone</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-[#6B6B76]">
                  {ev.actor_email} · {ev.actor_role}
                  {ev.entity_type ? ` · ${ev.entity_type}` : ""}
                  {ev.entity_id ? <span className="font-mono"> · {ev.entity_id}</span> : null}
                </p>
                {ev.reason ? <p className="mt-1 text-xs text-[#111]">{ev.reason}</p> : null}
                {ev.after?.sha256 ? <p className="mt-1 font-mono text-[11px] text-[#6B6B76]">sha256 {ev.after.sha256}</p> : null}
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
                    {role !== "admin" ? "Controller only" : busy === ev.id ? "…" : "Undo"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
