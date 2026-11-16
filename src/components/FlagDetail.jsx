// Flag detail drawer: SideBySide + timeline + status actions allowed by the lifecycle.
import React, { useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

const FLAG_DETAIL_USER_STATUSES = [
  { to: "dismissed", label: "Not a leak", needsReason: true, reasonPreset: "Not a leak" },
  { to: "dismissed", label: "Already handled", needsReason: true, reasonPreset: "Already handled" },
  { to: "disputed", label: "Disputed", needsReason: false },
];
const FLAG_DETAIL_ADMIN_STATUSES = [
  { to: "recovered", label: "Recovered", needsReference: true, refLabel: "Payment reference" },
  { to: "credited", label: "Credited", needsReference: true, refLabel: "Credit memo reference" },
];

function flagDetailAllowedButtons(status) {
  const out = [];
  if (status === "open") {
    out.push(...FLAG_DETAIL_USER_STATUSES.filter((b) => b.to === "dismissed"));
  }
  if (status === "sent" || status === "disputed") {
    if (status === "sent") out.push(FLAG_DETAIL_USER_STATUSES.find((b) => b.to === "disputed"));
    out.push(...FLAG_DETAIL_ADMIN_STATUSES);
  }
  return out.filter(Boolean);
}

export default function FlagDetail({ flag, timeline = [], onClose, onTransition, role = "admin" }) {
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!flag) return null;
  const buttons = flagDetailAllowedButtons(flag.status);

  const run = async (btn) => {
    setErr("");
    const payload = { flag_id: flag.id, to_status: btn.to };
    if (btn.needsReason) {
      const r = btn.reasonPreset || reason;
      if (!r.trim()) { setErr("Reason required"); return; }
      payload.reason = r;
    }
    if (btn.needsReference) {
      if (!reference.trim()) { setErr(`${btn.refLabel} required`); return; }
      payload.reference = reference.trim();
    }
    setBusy(true);
    try {
      await onTransition?.(payload);
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-label="Flag detail">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#F6F3EC] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DDD2] bg-white p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B5F68]">{flag.status}</p>
            <h2 className="text-lg font-semibold text-[#14171F]">{flag.title || flag.rule}</h2>
            <p className="mt-1 font-mono text-sm text-[#C22A25]">{fmt(flag.amount_cents)}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#F5F5F5] text-[#14171F]">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <SideBySide flag={flag} />

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#14171F]">Timeline</h3>
            {timeline.length ? (
              <ul className="space-y-2">
                {timeline.map((ev) => (
                  <li key={ev.id} className="rounded-2xl border border-[#E2DDD2] bg-white px-3 py-2 text-xs text-[#5B5F68]">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-[#14171F]">{ev.action}</span>
                      <span className="font-mono">{(ev.created_at || "").slice(0, 19)}</span>
                    </div>
                    <p>{ev.actor_email} · {ev.actor_role}</p>
                    {ev.reason ? <p className="mt-1">{ev.reason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#5B5F68]">No audit events yet for this flag.</p>
            )}
          </section>

          {buttons.length ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#14171F]">Status</h3>
              {(buttons.some((b) => b.needsReason && !b.reasonPreset) || buttons.some((b) => b.needsReference)) ? (
                <div className="space-y-2">
                  {buttons.some((b) => b.needsReason && !b.reasonPreset) ? (
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason"
                      className="min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
                    />
                  ) : null}
                  {buttons.some((b) => b.needsReference) ? (
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Payment or credit memo reference"
                      className="min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {buttons.map((btn) => {
                  const adminOnly = ["recovered", "credited"].includes(btn.to);
                  const disabled = busy || (adminOnly && role !== "admin");
                  return (
                    <button
                      key={`${btn.to}-${btn.label}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => run(btn)}
                      className="min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white disabled:opacity-40"
                      title={adminOnly && role !== "admin" ? "Controller only" : undefined}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
              {err ? <p className="text-xs text-[#C22A25]">{err}</p> : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
