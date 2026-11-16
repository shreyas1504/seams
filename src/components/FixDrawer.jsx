// One click from a cause (or one line) to a draft: catch-up invoice, credit memo, customer reply, supplier
// dispute or payment hold. Dana edits it, then approves or dismisses with a reason. Saved to Decisions.
// Amounts come from findings.csv rows; Base44 AI may only rewrite the wording ("Polish"), never the numbers.
import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { seamsNotifyFeedback } from "@/components/InteractionFeedback.jsx";

const FIX_KINDS = {
  catch_up_invoice: "Catch-up invoice",
  credit_memo: "Credit memo",
  customer_reply: "Customer reply",
  supplier_dispute: "Supplier dispute",
  payment_hold: "Payment hold",
};
const fixSum = (rows) => rows.reduce((a, f) => a + f.signed_cents, 0);

function fixDraftText(kind, rows) {
  const party = rows[0].party || "the account";
  const total = fixSum(rows);
  const lines = rows.slice(0, 25).map((f) => `- ${f.ids.join(" / ")}: ${f.rule}${f.signed_cents ? `, ${fmt(Math.abs(f.signed_cents))}` : ""}`);
  const more = rows.length > 25 ? [`- …and ${rows.length - 25} more lines`] : [];
  const body = [...lines, ...more].join("\n");
  switch (kind) {
    case "catch_up_invoice":
      return `To: ${party}\nSubject: Catch-up invoice, ${fmt(total)}\n\nHi ${party} team,\n\nWhile reconciling our records we found items that were delivered but not billed correctly:\n${body}\n\nTotal due: ${fmt(total)} (before sales tax where it applies). A detailed invoice is attached.\n\nThank you,\nNorthline Supply billing`;
    case "credit_memo":
      return `To: ${party}\nSubject: Credit memo, ${fmt(Math.abs(total))}\n\nHi ${party} team,\n\nWe found that you were overbilled and are issuing a credit:\n${body}\n\nCredit: ${fmt(Math.abs(total))}. It will appear on your next statement.\n\nSorry for the trouble,\nNorthline Supply billing`;
    case "customer_reply":
      return `To: ${party}\nSubject: Re: your message\n\nHi,\n\nSorry for the slow reply. [Answer the question here.]\n\nReferences:\n${body}\n\nBest,\nNorthline Supply`;
    case "supplier_dispute":
      return `To: ${party} accounts receivable\nSubject: Billing dispute, ${fmt(total)}\n\nHello,\n\nThese bill lines do not match our purchase orders and receiving records:\n${body}\n\nPlease send a credit for ${fmt(total)}, or a corrected invoice. We are holding these lines until then.\n\nThanks,\nNorthline Supply accounts payable`;
    case "payment_hold":
      return `INTERNAL · Payment hold\n\nHold payment on:\n${body}\n\nReason: bank details changed by email and not verified by phone, or the bill is a duplicate. Call the supplier at the number on file before releasing.\nAmount held: ${fmt(total)}`;
    default:
      return body;
  }
}

export default function FixDrawer({ rows, role, onClose }) {
  const first = rows[0];
  const [kind, setKind] = useState(first.action_type in FIX_KINDS ? first.action_type : first.signed_cents < 0 ? "credit_memo" : "catch_up_invoice");
  const [text, setText] = useState(() => fixDraftText(kind, rows));
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("Not a problem under the rules");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lock = useRef(false);
  const total = useMemo(() => fixSum(rows), [rows]);

  const switchKind = (k) => {
    setKind(k);
    setText(fixDraftText(k, rows));
  };

  const polish = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Rewrite this ${FIX_KINDS[kind]} to be clear, polite and short. Keep every record ID and every dollar amount exactly as written; do not add or change numbers.\n\n${text}`,
      });
      const out = typeof res === "string" ? res : res?.text || res?.output || "";
      const nums = (s) => (s.match(/\$[\d,]+\.\d{2}/g) || []).sort().join("|");
      if (out && nums(out) === nums(text)) setText(out);
      else setErr("AI changed an amount, so the original wording was kept.");
    } catch {
      setErr("AI is offline here; the draft is unchanged.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (status) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr("");
    try {
      const me = await base44.auth.me().catch(() => null);
      const at = new Date().toISOString();
      const who = me?.full_name || me?.email || "Dana";
      await base44.entities.Decision.bulkCreate(
        rows.map((f) => ({
          finding_id: f.finding_id,
          status,
          reason: status === "dismissed" ? reason : "",
          draft: status === "approved" ? text : "",
          action_type: kind,
          decided_by: who,
          decided_at: at,
        })),
      );
      seamsNotifyFeedback({ message: status === "approved" ? `Approved ${FIX_KINDS[kind].toLowerCase()} · ${rows.length} line${rows.length === 1 ? "" : "s"} · saved to Decisions. Nothing was sent.` : `Dismissed ${rows.length} line${rows.length === 1 ? "" : "s"}: ${reason}` });
      announceSeamsDataChanged();
      onClose();
    } catch (e) {
      setErr(e?.message || "Could not save the decision");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#1C1917]/30" role="presentation" onClick={onClose}>
      <aside className="seams-settle-sheet flex h-full w-full max-w-lg flex-col" role="dialog" aria-modal="true" aria-label={`Draft fix for ${first.cause}`} onClick={(e) => e.stopPropagation()}>
        <header className="seams-settle-sheet__header">
          <div>
            <p className="seams-settle-sheet__eyebrow">Draft fix · {rows.length} line{rows.length === 1 ? "" : "s"}</p>
            <h2 className="seams-settle-sheet__title">{first.cause}</h2>
          </div>
          <button type="button" className="seams-settle-sheet__close" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="seams-settle-sheet__body flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(FIX_KINDS).map(([k, label]) => (
              <button key={k} type="button" className="ask-chip" aria-pressed={kind === k} onClick={() => switchKind(k)}>{label}</button>
            ))}
          </div>
          <label className="mt-3 block text-[12px] font-medium text-[#1C1917]">
            Draft (edit freely; nothing is sent from this app)
            <textarea className="fix-draft mt-1" value={text} onChange={(e) => setText(e.target.value)} rows={16} />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="fix-quiet" disabled={busy} onClick={polish}>Polish wording with Base44 AI</button>
            <span className="text-[11px] text-[#6B635A]">Amounts are locked to findings.csv.</span>
          </div>
          {err ? <p className="mt-2 text-[12px] text-[#9F1239]" role="alert">{err}</p> : null}
        </div>
        <footer className="seams-settle-sheet__footer">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-[#6B635A]">Total from findings.csv</span>
            <span className="money text-[20px] font-semibold">{total < 0 ? `${fmt(-total)} credit` : fmt(total)}</span>
          </div>
          {dismissing ? (
            <div className="mt-3 grid gap-2">
              <select className="settings-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option>Not a problem under the rules</option>
                <option>Exception approved by Dana</option>
                <option>Already fixed in QuickBooks</option>
                <option>Duplicate of another finding</option>
                <option>Too small to pursue</option>
              </select>
              <div className="flex gap-2">
                <button type="button" className="seams-settle-sheet__send" disabled={busy || role !== "admin"} onClick={() => decide("dismissed")}>Dismiss with this reason</button>
                <button type="button" className="fix-quiet" onClick={() => setDismissing(false)}>Back</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button type="button" className="seams-settle-sheet__send" disabled={busy || role !== "admin"} onClick={() => decide("approved")}>
                Approve {FIX_KINDS[kind].toLowerCase()}
              </button>
              <button type="button" className="seams-settle-sheet__cancel" disabled={busy} onClick={() => setDismissing(true)}>Dismiss…</button>
            </div>
          )}
          {role !== "admin" ? <p className="mt-2 text-[11px] text-[#6B635A]">Only a Controller can approve or dismiss.</p> : null}
        </footer>
      </aside>
    </div>
  );
}
