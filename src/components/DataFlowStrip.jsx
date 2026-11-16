// Compact how-data-works bar — AA contrast, tight spacing.
import React from "react";

const STEPS = [
  { id: "CRM", label: "CRM", color: "#2F5BD3" },
  { id: "WH", label: "Warehouse", color: "#B85E10" },
  { id: "BILL", label: "Billing", color: "#0F6B40" },
  { id: "AP", label: "AP", color: "#6B3FA0" },
];

export default function DataFlowStrip() {
  return (
    <section
      className="seam-card mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5"
      aria-label="How Seams data works"
    >
      <p className="mr-1 text-xs font-bold text-[#0A0A0A]">Data flow</p>
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ECECF0] px-2 py-1 text-xs font-semibold text-[#0A0A0A]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
          {i < STEPS.length - 1 ? (
            <span className="text-[#4A4A52]" aria-hidden>
              →
            </span>
          ) : null}
        </React.Fragment>
      ))}
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#111114] px-2 py-1 text-xs font-semibold text-white">
        Seams finds gaps
      </span>
      <span className="ml-auto text-[11px] font-medium text-[#4A4A52]">Code computes $ · AI never acts alone</span>
    </section>
  );
}
