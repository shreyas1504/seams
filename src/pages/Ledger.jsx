// Ledger: all AuditEvents newest first, filter by action/entity, Undo on reversible (admin).
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
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
      reload();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-semibold text-[#14171F]">Ledger</h1>
        <p className="text-sm text-[#5B5F68]">Every change, newest first</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
        >
          <option value="">All entities</option>
          {entities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {err ? <p className="text-sm text-[#C22A25]">{err}</p> : null}

      <ul className="space-y-2">
        {filtered.map((ev) => (
          <li key={ev.id} className="rounded-[24px] border border-[#E2DDD2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#14171F]">
                  {ev.action}
                  {ev.undone ? (
                    <span className="ml-2 rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-normal text-[#5B5F68]">undone</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-[#5B5F68]">
                  {ev.actor_email} · {ev.actor_role}
                  {ev.entity_type ? ` · ${ev.entity_type}` : ""}
                  {ev.entity_id ? <span className="font-mono"> · {ev.entity_id}</span> : null}
                </p>
                {ev.reason ? <p className="mt-1 text-xs text-[#14171F]">{ev.reason}</p> : null}
                {ev.after?.sha256 ? <p className="mt-1 font-mono text-[11px] text-[#5B5F68]">sha256 {ev.after.sha256}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] text-[#5B5F68]">{(ev.created_at || ev.created_date || "").slice(0, 19)}</p>
                {ev.reversible && !ev.undone ? (
                  <button
                    type="button"
                    disabled={role !== "admin" || busy === ev.id}
                    onClick={() => undo(ev.id)}
                    className="mt-2 min-h-[44px] rounded-2xl bg-[#000000] px-3 text-xs font-medium text-white disabled:opacity-40"
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
