// H9 — patterns ranked by dollars.
import React, { useState } from "react";
import { fmt } from "@/lib/engine/engine.js";

export default function PatternList({ patterns, onSuggestFix }) {
  const [openKey, setOpenKey] = useState(null);
  const sorted = [...(patterns || [])].sort((a, b) => b.amount_cents - a.amount_cents);
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[#14171F]">Patterns</h2>
      {!sorted.length ? (
        <p className="rounded-[28px] bg-white p-4 text-sm text-[#5B5F68] shadow-[0_8px_24px_rgba(0,0,0,0.04)]" role="status">
          No patterns yet.
        </p>
      ) : null}
      {sorted.map((p) => {
        const open = openKey === p.key;
        return (
          <article key={p.key} className="rounded-[28px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : p.key)}
              className="flex min-h-[44px] w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-[#14171F]">{p.title}</h3>
                <p className="mt-1 text-xs text-[#5B5F68]">{p.detail}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-[#C22A25]">{fmt(p.amount_cents)}</span>
            </button>
            {open ? (
              <div className="mt-3 border-t border-[#EFEFEF] pt-3">
                <p className="text-xs text-[#5B5F68]">Suggested fix: {p.fix}</p>
                <p className="mt-1 font-mono text-[11px] text-[#5B5F68]">{(p.keys || []).length} member flags</p>
                {onSuggestFix ? (
                  <button
                    type="button"
                    onClick={() => onSuggestFix(p)}
                    className="mt-3 min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white"
                  >
                    Suggest fix
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
