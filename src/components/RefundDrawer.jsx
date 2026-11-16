// Vendor refund drawer — one direction, lines from vendor-lane flags.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { seamsNotifyFeedback, seamsNotifySent, useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";

export default function RefundDrawer({ party, role = "admin", pendingAction = null, onClose, onSent, onPending }) {
  const [draft, setDraft] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [subject, setSubject] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSecond, setPendingSecond] = useState(pendingAction);
  const sendLock = useRef(false);
  useSeamsDrawerLifecycle(onClose);
  useEffect(() => { if (err) seamsNotifyFeedback({ error: true, message: err }); }, [err]);

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
    if (sendLock.current || pendingSecond) return;
    if (role !== "admin") { setErr("Controller only"); return; }
    sendLock.current = true;
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
        <div className="seams-settle-sheet seams-settle-sheet__loading h-full w-full max-w-lg" role="dialog" aria-label="Refund letter">
          <header className="seams-settle-sheet__header">
            <div><div className="seams-settle-sheet__eyebrow">Settle · vendor</div><h2 className="seams-settle-sheet__title">{party}</h2></div>
            <button type="button" onClick={onClose} className="seams-settle-sheet__close" aria-label="Close">×</button>
          </header>
          {err ? <p className="seams-settle-sheet__error" role="alert">{err}</p> : <><p className="text-xs text-muted">Building refund preview…</p><div className="seams-skeleton mt-4 h-32" /></>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-label="Refund letter">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="seams-settle-sheet flex h-full w-full max-w-lg flex-col">
        <header className="seams-settle-sheet__header">
          <div><div className="seams-settle-sheet__eyebrow">Settle · vendor refund</div><h2 className="seams-settle-sheet__title">{party}</h2></div>
          <button type="button" onClick={onClose} className="seams-settle-sheet__close" aria-label="Close">×</button>
        </header>
        <main className="seams-settle-sheet__body">
          <div className="seams-settle-sheet__controls">
            <span className="seams-settle-sheet__control-label">To</span>
            <div className="seams-settle-sheet__control-value">
              <input aria-label="Recipient" value={draft.to || ""} readOnly className="seams-settle-sheet__input" />
              <span className="seams-settle-sheet__locked">from contract · locked</span>
            </div>
            <label className="seams-settle-sheet__control-label" htmlFor="refund-subject">Subject</label>
            <input id="refund-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="seams-settle-sheet__input" />
          </div>
          <article className="seams-settle-sheet__preview">
            <p className="seams-settle-sheet__greeting">{draft.greeting}</p>
            {draft.sections.map((sec) => (
              <section className="seams-settle-sheet__section" key={sec.title}>
                <h3 className="seams-settle-sheet__section-title">{sec.title}</h3>
                <div className="seams-settle-sheet__lines">
                  {sec.lines.map((line) => (
                    <div className="seams-settle-sheet__line" key={line.key}>
                      <input type="checkbox" checked={!exclude.includes(line.key)} onChange={() => toggleKey(line.key)} aria-label={`Include ${line.text}`} />
                      <span className="seams-settle-sheet__line-copy">{line.text}</span>
                      <span className="seams-settle-sheet__line-amount">{fmt(line.signed_cents ?? line.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="seams-settle-sheet__closing">{draft.closing}</p>
            <p className="seams-settle-sheet__fineprint">{draft.footer}</p>
          </article>
          <section className="seams-settle-sheet__receipt-section">
            <h3 className="seams-settle-sheet__receipt-title">Receipt · records behind each line</h3>
            <div className="seams-settle-sheet__receipt-wrap">
              <table className="seams-settle-sheet__receipt">
                <thead><tr><th>System</th><th>Record</th><th>Fields</th></tr></thead>
                <tbody>
                  {draft.receipt.map((r, i) => (
                    <tr key={i}>
                      <td>{r.system}</td>
                      <td>{r.id}</td>
                      <td>{Object.entries(r.fields || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
        <footer className="seams-settle-sheet__footer">
          <div className="seams-settle-sheet__total-row">
            <span className="seams-settle-sheet__control-label">Total</span>
            <strong className="seams-settle-sheet__total">{fmt(draft.total_cents)}</strong>
          </div>
          {pendingSecond ? (
            <div className="seams-settle-sheet__approval">
              <p>Waiting for a second Controller to approve this send.</p>
              <button type="button" disabled={busy || role !== "admin"} onClick={approve}>
                {busy ? <><span className="seams-spinner" /> Sending…</> : "Approve as second Controller"}
              </button>
            </div>
          ) : null}
          {err ? <p className="seams-settle-sheet__error" role="alert">{err}</p> : null}
          <div className="seams-settle-sheet__actions">
            <button
              type="button"
              disabled={busy || role !== "admin" || !!pendingSecond || !draft.flag_keys?.length || !draft.to}
              onClick={send}
              className="seams-settle-sheet__send"
            >
              {busy ? <><span className="seams-spinner" /> Sending…</> : role !== "admin" ? "Controller only" : `Request ${fmt(draft.total_cents)} refund`}
            </button>
            <button type="button" disabled={busy} onClick={onClose} className="seams-settle-sheet__cancel">Cancel</button>
          </div>
          <p className="seams-settle-sheet__status" role="status">
            {busy ? "Sending…" : role !== "admin" ? "Controller approval needed" : pendingSecond ? "Waiting for a second Controller" : !draft.flag_keys?.length ? "Nothing left to send" : !draft.to ? "No recipient on file" : Math.abs(draft.total_cents) >= 500000 ? "Needs a second Controller over $5,000" : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
