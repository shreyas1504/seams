// Customer / correction letter drawer: sections, SideBySide, exclude toggles, receipt, send gate.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { useEntity } from "@/lib/useEntity";
import { settleCreditCopy } from "@/components/settleCreditCopy.js";
import SettleReceipt from "@/components/SettleReceipt.jsx";
import { settleRequestedBySelf, settlePendingParams, settleFriendlyError } from "@/components/settleApproval.js";
import { displayText } from "@/lib/displayText.js";
import { DEFAULT_SETTINGS } from "@/lib/engine/engine.js";
import { seamsNotifyFeedback, seamsNotifySent, useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";

export default function LetterDrawer({ party, kind = "customer", role = "admin", pendingAction = null, onClose, onSent, onPending }) {
  const [returnRows] = useEntity("Return");
  const [invoiceRows] = useEntity("Invoice");
  const [settingRows] = useEntity("Setting");
  const [draft, setDraft] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [subject, setSubject] = useState("");
  const [tone, setTone] = useState("warm");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSecond, setPendingSecond] = useState(pendingAction);
  const sendLock = useRef(false);
  const [selfRequested, setSelfRequested] = useState(false);
  useEffect(() => {
    let alive = true;
    settleRequestedBySelf(pendingSecond).then((v) => alive && setSelfRequested(v));
    return () => { alive = false; };
  }, [pendingSecond]);
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

  // A pending four-eyes request shows exactly what the requester asked for (same lines, same tone), locked.
  useEffect(() => {
    let alive = true;
    (async () => {
      const params = await settlePendingParams(pendingAction);
      if (!alive) return;
      const excl = params?.exclude_keys || [];
      const t = params?.tone || "warm";
      setExclude(excl);
      setTone(t);
      load(excl, t);
    })();
    return () => { alive = false; };
  }, [party, kind]);

  const toggleKey = (key) => {
    if (pendingSecond) return;
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
      // Credits we owe this customer are never dismissed along with the charges.
      for (const f of flags.filter((x) => x.status === "open" && x.bucket !== "credit_owed" && (draft?.flag_keys || []).includes(x.stable_key))) {
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

  // Withdraw a pending request (e.g. a line changed since it was requested). Uses the existing rejectAction call.
  const cancelRequest = async () => {
    if (sendLock.current || !pendingSecond) return;
    sendLock.current = true;
    setBusy(true);
    try {
      await base44.functions.invoke("rejectAction", { action_id: pendingSecond });
      setPendingSecond(null);
      setSelfRequested(false);
      seamsNotifyFeedback({ message: "Request cancelled. Nothing was sent." });
      onPending?.();
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
      const { data } = await base44.functions.invoke("approveSecond", { action_id: pendingSecond }).catch((e) => {
        throw new Error(settleFriendlyError(e));
      });
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
      <div className="fixed inset-0 z-40 flex justify-end bg-[#1C1917]/30">
        <div className="seams-settle-sheet seams-settle-sheet__loading h-full w-full max-w-lg" role="dialog" aria-label="Letter">
          <header className="seams-settle-sheet__header">
            <div><div className="seams-settle-sheet__eyebrow">Settle</div><h2 className="seams-settle-sheet__title">{party}</h2></div>
            <button type="button" onClick={onClose} className="seams-settle-sheet__close" aria-label="Close">×</button>
          </header>
          {err ? <p className="seams-settle-sheet__error" role="alert">{err}</p> : <><p className="text-xs text-[#6B635A]">Building letter preview…</p><div className="seams-skeleton mt-4 h-32" /></>}
        </div>
      </div>
    );
  }

  const limit = settingRows[0]?.four_eyes_threshold_cents ?? DEFAULT_SETTINGS.four_eyes_threshold_cents;
  const overLimit = Math.abs(draft.total_cents) >= limit;
  const primary = overLimit ? `Send for second approval · ${fmt(draft.total_cents)}` : `Send ${fmt(draft.total_cents)}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#1C1917]/30" role="dialog" aria-label="Letter">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="seams-settle-sheet flex h-full w-full max-w-lg flex-col">
        <header className="seams-settle-sheet__header">
          <div><div className="seams-settle-sheet__eyebrow">{kind === "customer" ? "Settle" : "Send"} · {kind}</div><h2 className="seams-settle-sheet__title">{party}</h2></div>
          <button type="button" onClick={onClose} className="seams-settle-sheet__close" aria-label="Close">×</button>
        </header>

        <main className="seams-settle-sheet__body">
          <div className="seams-settle-sheet__controls">
            <span className="seams-settle-sheet__control-label">To</span>
            <div className="seams-settle-sheet__control-value">
              <input aria-label="Recipient from contract" value={draft.to || ""} readOnly className="seams-settle-sheet__input" />
              <span className="seams-settle-sheet__locked">from contract · locked</span>
            </div>
            <label className="seams-settle-sheet__control-label" htmlFor="letter-subject">Subject</label>
            <input id="letter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="seams-settle-sheet__input" />
            <label className="seams-settle-sheet__control-label" htmlFor="letter-tone">Tone</label>
            <select
              id="letter-tone"
              value={tone}
              onChange={(e) => { setTone(e.target.value); load(exclude, e.target.value); }}
              className="seams-settle-sheet__input"
            >
              <option value="warm">Warm</option>
              <option value="firm">Firm</option>
              <option value="nudge">Nudge</option>
            </select>
          </div>

          <article className="seams-settle-sheet__preview">
            <p className="seams-settle-sheet__greeting">{draft.greeting}</p>
            {draft.sections.map((sec) => (
              <section className="seams-settle-sheet__section" key={sec.title}>
                <h3 className="seams-settle-sheet__section-title">{sec.title}</h3>
                <div className="seams-settle-sheet__lines">
                  {sec.lines.map((line) => (
                    <div className="seams-settle-sheet__line" key={line.key}>
                      {line.key.startsWith("_") ? <span aria-hidden="true" /> : (
                        <input
                          type="checkbox"
                          checked={!exclude.includes(line.key)}
                          disabled={Boolean(pendingSecond)}
                          onChange={() => toggleKey(line.key)}
                          aria-label={`Include ${line.text}`}
                        />
                      )}
                       <span className="seams-settle-sheet__line-copy">{displayText(settleCreditCopy(line, returnRows, invoiceRows))}</span>
                       {line.amount_cents ? <span className="seams-settle-sheet__line-amount">{fmt(line.signed_cents ?? line.amount_cents).replace(/^-/, "−")}</span> : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="seams-settle-sheet__closing">{draft.closing}</p>
            <p className="seams-settle-sheet__fineprint">{draft.footer}</p>
          </article>

          <SettleReceipt receipt={draft.receipt} />
        </main>

        <footer className="seams-settle-sheet__footer">
          <div className="seams-settle-sheet__total-row">
            <span className="seams-settle-sheet__control-label">Total</span>
            <strong className="seams-settle-sheet__total">{fmt(draft.total_cents)}</strong>
          </div>
          {pendingSecond ? (
            <div className="seams-settle-sheet__approval">
              <p>{selfRequested ? "You requested this send. A different Controller has to approve it." : "Waiting for a second Controller to approve this send."}</p>
              <button type="button" disabled={busy || role !== "admin" || selfRequested} onClick={approve}>
                {busy ? <><span className="seams-spinner" /> Sending…</> : "Approve as second Controller"}
              </button>
              <button type="button" className="fix-quiet mt-2" disabled={busy || role !== "admin"} onClick={cancelRequest}>
                Cancel this request
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
              title={role !== "admin" ? "Controller only" : undefined}
            >
              {busy ? <><span className="seams-spinner" /> Sending…</> : role !== "admin" ? "Controller only" : primary}
            </button>
            <button type="button" disabled={busy} onClick={onClose} className="seams-settle-sheet__cancel">Cancel</button>
          </div>
          <div className="seams-settle-sheet__footer-tools">
            <button type="button" disabled={busy || Boolean(pendingSecond)} onClick={() => dismiss("Not a leak")} className="seams-settle-sheet__quiet">Not a leak</button>
            <button type="button" disabled={busy || Boolean(pendingSecond)} onClick={() => dismiss("Already handled")} className="seams-settle-sheet__quiet">Already handled</button>
          </div>
          <p className="seams-settle-sheet__status" role="status">
            {busy ? "Sending…" : role !== "admin" ? "Controller approval needed" : pendingSecond ? "Waiting for a second Controller" : !draft.flag_keys?.length ? "Nothing left to send" : !draft.to ? "No recipient on file" : overLimit ? `A second Controller approves sends over ${fmt(limit)}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
