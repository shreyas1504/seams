// H7 — ranked customer card with stepper and literal Square up / credit button.
import React, { useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { formatNetCents, squareUpLabel } from "@/lib/format.js";
import SideBySide from "@/components/SideBySide.jsx";

const STEPS = ["Found", "Letter ready", "Sent"];

function customerStepIndex(flags) {
  if (flags.some((f) => ["sent", "disputed", "recovered", "credited"].includes(f.status))) return 2;
  if (flags.some((f) => f.status === "open")) return 1;
  return 0;
}

export default function CustomerCard({ party, onSquareUp, onOpenFlag }) {
  const [expanded, setExpanded] = useState(false);
  const step = customerStepIndex(party.flags);
  const netClass = party.net < 0 ? "text-[#17734B]" : "text-[#C22A25]";
  return (
    <article className="rounded-[28px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#14171F]">{party.party}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            {party.owed_to_us ? (
              <span className="rounded-full bg-[#F8E8E8] px-2 py-0.5 text-[#C22A25]">{fmt(party.owed_to_us)} to bill</span>
            ) : null}
            {party.we_owe ? (
              <span className="rounded-full bg-[#E6F4EC] px-2 py-0.5 text-[#17734B]">we owe {fmt(party.we_owe)}</span>
            ) : (
              <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[#5B5F68]">no credits</span>
            )}
            {party.overdue ? (
              <span className="rounded-full bg-[#FBEFD6] px-2 py-0.5 text-[#8A5A00]">overdue {fmt(party.overdue)}</span>
            ) : null}
          </div>
        </div>
        <span className={`font-mono text-lg font-semibold ${netClass}`}>{formatNetCents(party.net || party.overdue)}</span>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${i <= step ? "bg-[#3B5BDB]" : "bg-[#D8D8D8]"}`}
              />
              <span className={`text-[10px] ${i <= step ? "text-[#14171F]" : "text-[#5B5F68]"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 ? <div className={`mb-4 h-px flex-1 ${i < step ? "bg-[#3B5BDB]" : "bg-[#E5E5E5]"}`} /> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => (onSquareUp ? onSquareUp(party) : setExpanded((v) => !v))}
          className="min-h-[44px] flex-1 rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white"
        >
          {squareUpLabel(party)}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-[#3B5BDB] text-white"
          aria-label={expanded ? "Collapse lines" : "Expand lines"}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-[#EFEFEF] pt-3">
          {party.flags.map((f) => (
            <div key={f.stable_key}>
              <button
                type="button"
                onClick={() => (onOpenFlag ? onOpenFlag(f) : null)}
                className={`flex min-h-[44px] w-full items-center justify-between text-left text-xs fade-on-clear${
                  f.status === "cleared" ? " is-cleared" : ""
                }`}
              >
                <span className="text-[#5B5F68]">{f.rule}</span>
                <span className="font-mono text-[#14171F]">{fmt(f.amount_cents)}</span>
              </button>
              <SideBySide flag={f} />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
