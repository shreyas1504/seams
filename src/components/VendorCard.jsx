// H8 — ranked vendor card with Request refund button.
import React, { useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

export default function VendorCard({ party, onRequestRefund, onOpenFlag }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="rounded-[28px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#14171F]">{party.party}</h3>
          <p className="mt-1 text-xs text-[#5B5F68]">{party.flags.length} lines to recover</p>
        </div>
        <span className="font-mono text-lg font-semibold text-[#C22A25]">{fmt(party.net)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => (onRequestRefund ? onRequestRefund(party) : setExpanded((v) => !v))}
          className="min-h-[44px] flex-1 rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white"
        >
          Request {fmt(party.net)} refund
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
                className="flex w-full items-center justify-between text-left text-xs"
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
