// Vendor refund drawer — one direction, lines from vendor-lane flags.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

export default function RefundDrawer({ party, role = "admin", onClose, onSent }) {
  const [draft, setDraft] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [subject, setSubject] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSecond, setPendingSecond] = useState(null);

  const load = async (excl = exclude) => {
    setErr("");
    try {
      const { data } = await base44.functions.invoke("buildLetter", {
        party,
        kind: "vendor",
        tone: "firm",
        exclude_keys: excl,
      });
      setDraft(data);
      setSubject(data.subject || "");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => { load([]); }, [party]);

  const toggleKey = (key) => {
    const next = exclude.includes(key) ? exclude.filter((k) => k !== key) : [...exclude, key];
    setExclude(next);
    load(next);
  };

  const send = async () => {
    if (role !== "admin") { setErr("Controller only"); return; }
    setBusy(true);
    setErr("");
    try {
      const { data } = await base44.functions.invoke("sendLetter", {
        party,
        kind: "vendor",
        tone: "firm",
        exclude_keys: exclude,
        subject,
        total_cents: draft.total_cents,
      });
      if (data.pending_second) setPendingSecond(data.pending_second);
      else {
        onSent?.(data);
        onClose?.();
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
        <div className="h-full w-full max-w-lg bg-white p-6 text-sm text-[#5B5F68]">Building refund…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-label="Refund letter">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#F6F3EC]">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DDD2] bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-[#14171F]">{party}</h2>
            <p className="text-xs text-[#5B5F68]">Vendor refund</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#F5F5F5]">✕</button>
        </div>
        <div className="space-y-4 p-4">
          <label className="block text-xs text-[#5B5F68]">
            To
            <input value={draft.to || ""} readOnly className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-[#F5F5F5] px-3 font-mono text-sm" />
          </label>
          <label className="block text-xs text-[#5B5F68]">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm" />
          </label>
          <p className="text-sm">{draft.greeting}</p>
          {draft.sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 text-sm font-semibold">{sec.title}</h3>
              <ul className="space-y-3">
                {sec.lines.map((line) => (
                  <li key={line.key} className="rounded-2xl border border-[#E2DDD2] bg-white p-3">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={!exclude.includes(line.key)} onChange={() => toggleKey(line.key)} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs">{line.text}</p>
                        <p className="mt-1 font-mono text-sm text-[#C22A25]">{fmt(line.amount_cents)}</p>
                        {line.flag ? <SideBySide flag={line.flag} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-sm">{draft.closing}</p>
          <p className="text-xs text-[#5B5F68]">{draft.footer}</p>
          {pendingSecond ? (
            <p className="rounded-2xl bg-[#E8EEFF] px-3 py-2 text-xs text-[#3B5BDB]">
              Needs a second Controller (action {pendingSecond}).
            </p>
          ) : null}
          {err ? <p className="text-xs text-[#C22A25]">{err}</p> : null}
          <button
            type="button"
            disabled={busy || role !== "admin" || !!pendingSecond}
            onClick={send}
            className="min-h-[44px] w-full rounded-2xl bg-[#000000] text-sm font-medium text-white disabled:opacity-40"
          >
            {role !== "admin" ? "Controller only" : `Request ${fmt(draft.total_cents)} refund`}
          </button>
        </div>
      </div>
    </div>
  );
}
