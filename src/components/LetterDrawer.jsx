// Customer / correction letter drawer: sections, SideBySide, exclude toggles, receipt, send gate.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";
import { seamsNotifyFeedback, seamsNotifySent, useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";

export default function LetterDrawer({ party, kind = "customer", role = "admin", cardNet, pendingAction = null, onClose, onSent, onPending }) {
  const [draft, setDraft] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [subject, setSubject] = useState("");
  const [tone, setTone] = useState("warm");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSecond, setPendingSecond] = useState(pendingAction);
  const sendLock = useRef(false);
  useSeamsDrawerLifecycle(onClose);
  useEffect(() => { if (err) seamsNotifyFeedback({ error: true, message: err }); }, [err]);

  const load = async (excl = exclude, t = tone) => {
    setErr("");
    try {
      const { data } = await base44.functions.invoke("buildLetter", {
        party,
        kind,
        tone: t,
        exclude_keys: excl,
      });
      setDraft(data);
      setSubject(data.subject || "");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => { load([], "warm"); }, [party, kind]);

  const toggleKey = (key) => {
    if (key.startsWith("_")) return;
    const next = exclude.includes(key) ? exclude.filter((k) => k !== key) : [...exclude, key];
    setExclude(next);
    load(next, tone);
  };

  const send = async () => {
    if (sendLock.current || pendingSecond) return;
    if (role !== "admin") { setErr("Controller only"); return; }
    sendLock.current = true;
    setBusy(true);
    setErr("");
    try {
      const { data } = await base44.functions.invoke("sendLetter", {
        party,
        kind,
        tone,
        exclude_keys: exclude,
        subject,
        total_cents: draft.total_cents,
      });
      if (data.pending_second) {
        setPendingSecond(data.pending_second);
        onPending?.(data);
      } else {
        void seamsNotifySent(data).catch(() => seamsNotifyFeedback({ message: `Sent to ${party} · ${fmt(Math.abs(draft.total_cents))}.` }));
        onSent?.(data);
        onClose?.();
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  };

  const dismiss = async (reason) => {
    setBusy(true);
    setErr("");
    try {
      const openFlags = (draft?.flag_keys || [])
        .map((k) => draft.sections.flatMap((s) => s.lines).find((l) => l.key === k)?.flag)
        .filter(Boolean);
      const flags = await base44.entities.Flag.filter({ party });
      for (const f of flags.filter((x) => x.status === "open" && (draft?.flag_keys || []).includes(x.stable_key))) {
        await base44.functions.invoke("transitionFlag", {
          flag_id: f.id,
          to_status: "dismissed",
          reason,
        });
      }
      void openFlags;
      onSent?.({ dismissed: true });
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  // A different Controller completes a pending four-eyes send.
  const approve = async () => {
    if (sendLock.current) return;
    sendLock.current = true;
    setBusy(true);
    setErr("");
    try {
      const { data } = await base44.functions.invoke("approveSecond", { action_id: pendingSecond });
      void seamsNotifySent(data).catch(() => seamsNotifyFeedback({ message: `Sent to ${party} · ${fmt(Math.abs(draft.total_cents))}.` }));
      onSent?.(data);
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-ink/30">
        <div className="h-full w-full max-w-lg bg-white p-6 text-sm text-muted" role="dialog" aria-label="Letter">
          <button onClick={onClose}>Close</button>
          {err ? <p role="alert">{err}</p> : <><p>Building letter…</p><div className="seams-skeleton mt-4 h-32" /></>}
        </div>
      </div>
    );
  }

  const primary =
    draft.total_cents < 0
      ? `Send ${fmt(-draft.total_cents)} credit letter`
      : `Send ${fmt(draft.total_cents)} settlement`;
  const netOk = cardNet == null || cardNet === draft.total_cents;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-label="Letter">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-paper">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white p-4">
          <div>
            <h2 className="font-display text-[20px] font-semibold text-ink">{party}</h2>
            <p className="text-xs text-muted">{kind} letter</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-2xl bg-chip">✕</button>
        </div>

        <div className="space-y-4 p-4">
          <label className="block text-xs text-muted">
            To (from the contract)
            <input value={draft.to || ""} readOnly className="mt-1 min-h-[44px] w-full rounded-2xl border border-line bg-chip px-3 font-mono text-sm" />
          </label>
          <label className="block text-xs text-muted">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-2xl border border-line bg-white px-3 text-sm" />
          </label>
          <label className="block text-xs text-muted">
            Tone
            <select
              value={tone}
              onChange={(e) => { setTone(e.target.value); load(exclude, e.target.value); }}
              className="mt-1 min-h-[44px] w-full rounded-2xl border border-line bg-white px-3 text-sm"
            >
              <option value="warm">Warm</option>
              <option value="firm">Firm</option>
              <option value="nudge">Nudge</option>
            </select>
          </label>

          <p className="text-sm text-ink">{draft.greeting}</p>

          {draft.sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 text-sm font-semibold text-ink">{sec.title}</h3>
              <ul className="space-y-3">
                {sec.lines.map((line) => (
                  <li key={line.key} className="rounded-2xl border border-line bg-white p-3">
                    <div className="flex items-start gap-2">
                      {line.key.startsWith("_") ? null : (
                        <input
                          type="checkbox"
                          checked={!exclude.includes(line.key)}
                          onChange={() => toggleKey(line.key)}
                          className="mt-1"
                          aria-label="Include line"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink">{line.text}</p>
                        {line.amount_cents ? (
                          <p className="mt-1 font-mono text-sm text-owed">{fmt(line.signed_cents ?? line.amount_cents)}</p>
                        ) : null}
                        {line.flag ? <SideBySide flag={line.flag} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-sm text-ink">{draft.closing}</p>
          <p className="text-xs text-muted">{draft.footer}</p>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Receipt</h3>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="text-muted">
                  <tr>
                    <th className="px-2 py-1">System</th>
                    <th className="px-2 py-1">Id</th>
                    <th className="px-2 py-1">Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.receipt.map((r, i) => (
                    <tr key={i} className="border-t border-line font-mono">
                      <td className="px-2 py-1">{r.system}</td>
                      <td className="px-2 py-1">{r.id}</td>
                      <td className="px-2 py-1">{Object.entries(r.fields || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="font-mono text-xs text-ink">
            Letter total {fmt(draft.total_cents)}
            {cardNet != null ? ` = card net ${fmt(cardNet)}` : ""}
            {!netOk ? " · totals differ" : ""}
          </p>

          {pendingSecond ? (
            <div className="rounded-2xl bg-[#EEF0FD] px-3 py-2.5 text-xs text-[#4338CA]">
              <p>Waiting for a second Controller to approve this send.</p>
              <button
                type="button"
                disabled={busy || role !== "admin"}
                onClick={approve}
                className="mt-2 min-h-[36px] rounded-full border border-[#4338CA] px-3 font-medium disabled:opacity-40"
              >
                {busy ? <><span className="seams-spinner" /> Sending…</> : "Approve as second Controller"}
              </button>
            </div>
          ) : null}

          {err ? <p className="text-xs text-owed">{err}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || role !== "admin" || !!pendingSecond || !draft.flag_keys?.length || !draft.to}
              onClick={send}
              className="min-h-[44px] flex-1 rounded-2xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-40"
              title={role !== "admin" ? "Controller only" : undefined}
            >
              {busy ? <><span className="seams-spinner" /> Sending…</> : role !== "admin" ? "Controller only" : primary}
            </button>
            <button type="button" disabled={busy} onClick={() => dismiss("Not a leak")} className="min-h-[44px] rounded-2xl border border-line bg-white px-3 text-xs">
              Not a leak
            </button>
            <button type="button" disabled={busy} onClick={() => dismiss("Already handled")} className="min-h-[44px] rounded-2xl border border-line bg-white px-3 text-xs">
              Already handled
            </button>
          </div>
          <p className="text-xs text-muted" role="status">
            {busy ? "Sending…" : role !== "admin" ? "Controller approval needed" : pendingSecond ? "Waiting for a second Controller" : !draft.flag_keys?.length ? "Nothing left to send" : !draft.to ? "No recipient on file" : Math.abs(draft.total_cents) >= 500000 ? "Needs a second Controller over $5,000" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
