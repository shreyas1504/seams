// "Today's fixes": one card per open flag in the selected seam, largest first.
// Card click selects the flag for the proof; the dark pill opens the existing letter / refund flow.
import React, { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { seamLabel } from "@/components/systems.js";
import { fixTitle, fixActionLabel } from "@/components/fixProof.js";

const FIX_DISMISS_REASONS = ["Expected exception", "Already handled", "Data error", "Other"];
const FIX_COLLAPSE_MS = 220;

function fixAmountClass(flag) {
  if (flag.bucket === "overdue") return "text-overdue";
  if (flag.bucket === "credit_owed") return "text-credit";
  return "text-owed";
}

function FixDismissPopover({ onConfirm, onCancel }) {
  const [choice, setChoice] = useState(FIX_DISMISS_REASONS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("input")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onCancel]);

  const reason = choice === "Other" ? other.trim() : choice;

  const confirm = async () => {
    if (!reason) {
      setErr("Add a short reason.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onConfirm(reason);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="fix-popover" role="dialog" aria-label="Why is this not an issue?">
      <p className="text-[12px] font-medium text-ink">Why is this not an issue?</p>
      <div className="mt-2 space-y-1" role="radiogroup">
        {FIX_DISMISS_REASONS.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
            <input type="radio" name="fix-dismiss-reason" checked={choice === r} onChange={() => setChoice(r)} />
            {r}
          </label>
        ))}
      </div>
      {choice === "Other" ? (
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Reason"
          aria-label="Other reason"
          className="mt-2 h-8 w-full rounded-lg border border-line bg-white px-2 text-[12px]"
        />
      ) : null}
      {err ? <p className="mt-2 text-[11px] text-overdue">{err}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="fix-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="fix-pill" disabled={busy} onClick={confirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function FixCard({ flag, selected, isNew, stamp, onSelect, onAct, onDismiss, customerLabel }) {
  const [asking, setAsking] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  const dismiss = async (reason) => {
    await onDismiss(flag, reason, () => setCollapsing(true));
    setAsking(false);
  };

  return (
    <li className={`fix-collapse${collapsing ? " is-collapsing" : ""}`}>
      <div className="fix-collapse-inner">
        <div
          className={`fix-card${selected ? " is-selected" : ""}`}
          onClick={() => onSelect(flag)}
        >
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="block w-full text-left"
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(flag);
              }}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-ink">{fixTitle(flag)}</span>
                {isNew ? <span className="fix-new">NEW</span> : null}
              </span>
              <span className="fix-why mt-0.5 block text-[12px] leading-[1.45] text-muted" title={flag.why}>
                {flag.why}
              </span>
            </button>
            {stamp ? null : (
              <div className="relative mt-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="fix-quiet" aria-expanded={asking} onClick={() => setAsking((v) => !v)}>
                  Not an issue
                </button>
                {asking ? <FixDismissPopover onConfirm={dismiss} onCancel={() => setAsking(false)} /> : null}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className={`money text-[13px] font-semibold ${fixAmountClass(flag)}`}>{fmt(flag.amount_cents || 0)}</span>
              {stamp === "sent" ? (
                <span className="fix-stamp fix-stamp-sent">SENT</span>
              ) : stamp === "approval" ? (
                <span className="fix-stamp fix-stamp-approval">NEEDS APPROVAL</span>
              ) : (
                <button type="button" className="fix-pill" onClick={() => onAct(flag)}>
                  {flag.bucket === "credit_owed" ? `Include in ${flag.party} letter` : flag.lane === "vendor" ? fixActionLabel(flag) : customerLabel}
                </button>
              )}
            </div>
            {stamp === "approval" ? (
              <button type="button" className="fix-quiet" onClick={() => onAct(flag)}>
                Waiting for a second Controller
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function TodaysFixes({ seam, cards, rootCause, selectedKey, newKeys, stamps, lookAlikes, onSelect, onAct, onDismiss, customerLabels }) {
  const regular = cards.filter((f) => f.bucket !== "credit_owed");
  const credits = cards.filter((f) => f.bucket === "credit_owed");
  return (
    <section className="rise lg:col-span-6" aria-label="Today's fixes">
      <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">
        Today's fixes{seam ? ` · ${seamLabel(seam)} (${regular.filter((f) => (f.status || "open") === "open").length})` : ""}
      </h2>
      {rootCause ? <p className="mt-1 text-[12.5px] text-muted">Root cause: {rootCause}</p> : null}

      {!regular.length ? (
        <p className="card mt-4 px-4 py-6 text-center text-[14px] text-muted">
          Nothing open on this seam. {lookAlikes} look-alikes checked.
        </p>
      ) : (
        <ul className="mt-4" aria-label={`Open findings on ${seamLabel(seam)}`}>
          {regular.map((f) => (
            <FixCard
              key={f.stable_key}
              flag={f}
              selected={f.stable_key === selectedKey}
              isNew={newKeys.has(f.stable_key)}
              stamp={stamps.get(f.stable_key) || null}
              onSelect={onSelect}
              onAct={onAct}
              onDismiss={onDismiss}
              customerLabel={customerLabels.get(f.party)}
            />
          ))}
        </ul>
      )}
      {credits.length ? <>
        <h3 className="mt-4 text-[13px] font-semibold text-credit">Credits we owe ({credits.length})</h3>
        <ul className="mt-2" aria-label="Credits we owe">
          {credits.map((f) => <FixCard key={f.stable_key} flag={f} selected={f.stable_key === selectedKey} isNew={newKeys.has(f.stable_key)} stamp={stamps.get(f.stable_key)} onSelect={onSelect} onAct={onAct} onDismiss={onDismiss} />)}
        </ul>
      </> : null}
    </section>
  );
}

export { FIX_COLLAPSE_MS };
