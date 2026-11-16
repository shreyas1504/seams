// "Proof · Trace": finding → root cause → records side by side → math → checked and ruled out.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";
import { SYSTEM_TINT } from "@/components/systems.js";
import { fixTitle, fixRecords, fixMathLine, fixRuledOutFor, fixDownloadEvidence } from "@/components/fixProof.js";
import { displayText, displayField } from "@/lib/displayText.js";
import FindingChart from "@/components/FindingChart.jsx";
import { openSeamsLookup } from "@/actions/dataChanged.js";

function ProofStep({ dot, label, last, children }) {
  return (
    <li className="relative pl-6">
      {last ? null : <span className="proof-line" aria-hidden />}
      <span className="proof-dot" style={dot} aria-hidden />
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#6B635A]">{label}</p>
      <div className="mt-1">{children}</div>
    </li>
  );
}

export default function ProofTrace({ flag, rootCause, ruled, flags = [], invoices = [] }) {
  if (!flag) {
    return (
      <section className="card rise flex min-h-[220px] items-center justify-center p-5 lg:col-span-6" aria-label="Proof trace">
        <p className="text-[13px] text-[#6B635A]">Pick a finding to see its proof.</p>
      </section>
    );
  }

  const records = fixRecords(flag);
  const math = fixMathLine(flag);
  const ruledOut = fixRuledOutFor(flag, ruled);
  const amountClass = flag.bucket === "overdue" ? "text-[#9F1239]" : flag.bucket === "credit_owed" ? "text-[#0F766E]" : "text-[#1C1917]";

  return (
    <section className="card rise p-5 lg:col-span-6" aria-label="Proof trace">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6B635A]">Proof · Trace</p>
        <button type="button" className="fix-quiet" onClick={() => fixDownloadEvidence(flag)}>
          Download evidence pack
        </button>
      </div>

      <ol className="mt-4 space-y-4">
        <ProofStep dot={{ background: "#C2410C" }} label="Finding">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[17px] font-semibold leading-snug text-[#1C1917]">{fixTitle(flag)}</h3>
            <span className={`money text-[16px] font-semibold ${amountClass}`}>{fmt(flag.amount_cents || 0)}</span>
          </div>
        </ProofStep>

        <ProofStep dot={{ background: "#1F4D3A" }} label="Root cause">
          <p className="text-[13px] text-[#1C1917]">{rootCause}</p>
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
                  <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B635A]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tint?.ink || "#6B635A" }} aria-hidden />
                    {r.id ? (
                      <button type="button" className="record-link" onClick={() => openSeamsLookup(r.id)} aria-label={`Look up ${r.id}`}>
                        {r.label}
                      </button>
                    ) : (
                      r.label
                    )}
                  </p>
                  {r.primary ? (
                    <>
                      <p className="mt-1.5 text-[11.5px] text-[#6B635A]">{r.primary.label}</p>
                      <p className="proof-value money text-[15px] font-medium">{displayField(r.primary.key, r.primary.value)}</p>
                    </>
                  ) : null}
                  {r.others.length ? (
                    <p className="mt-1.5 text-[10.5px] leading-[1.5] text-[#6B635A]">
                      {r.others.map((o) => (
                        <span key={o.key} className="mr-2 inline-block">
                          {o.label} <span className="money text-[#1C1917]">{displayField(o.key, o.value)}</span>
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
          <p className="money text-[13px] text-[#1C1917]">{math}</p>
          <FindingChart flag={flag} flags={flags} invoices={invoices} />
        </ProofStep>

        {ruledOut ? (
          <ProofStep dot={{ background: "#FFFFFF", border: "1.5px dashed #A8A29E" }} label="Checked and ruled out" last>
            <p className="ruled-reason text-[12.5px] text-[#57534E]">
              <span className="ruled-check" aria-hidden>✓</span>
              {displayText(ruledOut.reason)}
            </p>
          </ProofStep>
        ) : null}
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="chip chip-neutral">Computed by rule, not AI</span>
        <span className="chip chip-neutral">Click a record ID to look it up</span>
      </div>
    </section>
  );
}
