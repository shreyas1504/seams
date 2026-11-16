// H6 — needs review: unmatched join issues and correction-owed sent lines.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";

export default function NeedsReview({ flags, joinIssues = [], onOpenFlag }) {
  const correction = (flags || []).filter((f) => f.status === "needs_review");
  if (!correction.length && !joinIssues.length) return null;
  return (
    <section className="rounded-[28px] border border-[#FBEFD6] bg-[#FFFBF2] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
      <h2 className="text-base font-semibold text-[#8A5A00]">Needs review</h2>
      {correction.length ? (
        <ul className="mt-3 space-y-2">
          {correction.map((f) => (
            <li key={f.id || f.stable_key}>
              <button
                type="button"
                onClick={() => onOpenFlag?.(f)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-2xl bg-white px-3 py-2 text-left text-xs"
              >
                <span className="text-[#14171F]">
                  {f.party}: {f.review_reason || "Correction owed"}
                </span>
                <span className="font-mono text-[#C22A25]">{fmt(f.amount_cents)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {joinIssues.length ? (
        <ul className="mt-3 space-y-1 text-xs text-[#5B5F68]">
          {joinIssues.map((j, i) => (
            <li key={i} className="font-mono">
              {j.type}: {j.id || j.name || JSON.stringify(j)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
