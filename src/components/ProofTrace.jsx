// "Proof · Trace": finding → root cause → records side by side → math → checked and ruled out.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";
import { SYSTEM_TINT } from "@/components/systems.js";
import { fixTitle, fixRecords, fixMathLine, fixRuledOutFor, fixDownloadEvidence } from "@/components/fixProof.js";

function ProofStep({ dot, label, last, children }) {
  return (
    <li className="relative pl-6">
      {last ? null : <span className="proof-line" aria-hidden />}
      <span className="proof-dot" style={dot} aria-hidden />
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </li>
  );
}

export default function ProofTrace({ flag, rootCause, ruled }) {
  if (!flag) {
    return (
      <section className="card rise flex min-h-[220px] items-center justify-center p-5 lg:col-span-6" aria-label="Proof trace">
        <p className="text-[13px] text-muted">Pick a finding to see its proof.</p>
      </section>
    );
  }

  const records = fixRecords(flag);
  const math = fixMathLine(flag);
  const ruledOut = fixRuledOutFor(flag, ruled);
  const amountClass = flag.bucket === "overdue" ? "text-overdue" : flag.bucket === "credit_owed" ? "text-credit" : "text-ink";

  return (
    <section className="card rise p-5 lg:col-span-6" aria-label="Proof trace">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Proof · Trace</p>
        <button type="button" className="fix-quiet" onClick={() => fixDownloadEvidence(flag)}>
          Download evidence pack
        </button>
      </div>

      <ol className="mt-4 space-y-4">
        <ProofStep dot={{ background: "#C2410C" }} label="Finding">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">{fixTitle(flag)}</h3>
            <span className={`money text-[16px] font-semibold ${amountClass}`}>{fmt(flag.amount_cents || 0)}</span>
          </div>
        </ProofStep>

        <ProofStep dot={{ background: "#1F4D3A" }} label="Root cause">
          <p className="text-[13px] text-ink">{rootCause}</p>
        </ProofStep>

        <ProofStep dot={{ background: "#1C1917" }} label="Records side by side">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(records.length, 1), 3)}, minmax(0, 1fr))` }}
          >
            {records.map((r, i) => {
              const tint = SYSTEM_TINT[r.system];
              return (
                <div key={`${r.label}-${i}`} className={`proof-record${r.tinted ? " is-diff" : ""}`}>
                  <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tint?.ink || "#6B635A" }} aria-hidden />
                    {r.label}
                  </p>
                  {r.primary ? (
                    <>
                      <p className="mt-1.5 text-[11.5px] text-muted">{r.primary.label}</p>
                      <p className="proof-value money text-[15px] font-medium">{r.primary.value}</p>
                    </>
                  ) : null}
                  {r.others.length ? (
                    <p className="mt-1.5 text-[10.5px] leading-[1.5] text-muted">
                      {r.others.map((o) => (
                        <span key={o.key} className="mr-2 inline-block">
                          {o.label} <span className="money text-ink">{o.value}</span>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ProofStep>

        <ProofStep dot={{ background: "#6B635A" }} label="Math" last={!ruledOut}>
          <p className="money text-[13px] text-ink">{math}</p>
        </ProofStep>

        {ruledOut ? (
          <ProofStep dot={{ background: "#FFFFFF", border: "1.5px dashed #A8A29E" }} label="Checked and ruled out" last>
            <p className="text-[12.5px] text-muted line-through opacity-60">{ruledOut.reason}</p>
          </ProofStep>
        ) : null}
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="chip chip-neutral">Computed by rule, not AI</span>
        <span className="chip chip-neutral">Every number links to its record</span>
      </div>
    </section>
  );
}
