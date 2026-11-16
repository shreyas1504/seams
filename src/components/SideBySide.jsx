// Proof panel: one column per system, disagreeing field highlighted, how-we-caught-it, lineage line.
import React from "react";

const SBS_COLOR = {
  CRM: "bg-[#2F5BD3]",
  Warehouse: "bg-[#D9731A]",
  Billing: "bg-[#1F8A5B]",
  AP: "bg-[#7A4FC9]",
  Returns: "bg-[#5B5F68]",
};
const SBS_LINEAGE_KEYS = new Set(["import_batch", "source_row"]);

function sbsFieldHighlight(flag, key) {
  if (key === flag.diff_field) return true;
  if (flag.diff_field === "qty" && String(key).includes("qty")) return true;
  return false;
}

function sbsLineageBits(flag) {
  const bits = [];
  for (const ev of flag.evidence || []) {
    const batch = ev.fields?.import_batch;
    const row = ev.fields?.source_row;
    if (batch) bits.push(row != null ? `${batch} · row ${row}` : batch);
  }
  return bits.length ? bits.join(" · ") : null;
}

export default function SideBySide({ flag }) {
  const lineage = sbsLineageBits(flag);
  return (
    <div className="mt-2 rounded border border-[#E2DDD2] bg-white p-3 text-sm">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${flag.evidence.length}, minmax(0,1fr))` }}>
        {flag.evidence.map((ev, i) => (
          <div key={i} className="rounded border border-[#E2DDD2] p-2">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#5B5F68]">
              <span className={`inline-block h-2 w-2 rounded-full ${SBS_COLOR[ev.system] || "bg-[#5B5F68]"}`} />
              {ev.system} · <span className="font-mono">{ev.id}</span>
            </div>
            {Object.entries(ev.fields || {})
              .filter(([k]) => !SBS_LINEAGE_KEYS.has(k))
              .map(([k, v]) => (
                <div
                  key={k}
                  className={`flex justify-between font-mono text-xs ${
                    sbsFieldHighlight(flag, k) ? "rounded bg-red-50 font-semibold text-[#C22A25]" : ""
                  }`}
                >
                  <span className="text-[#5B5F68]">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <p className="mt-2">{flag.why}</p>
      <p className="mt-1 font-mono text-[11px] text-[#5B5F68]">
        {flag.seam} · confidence {flag.confidence}
        {lineage ? ` · ${lineage}` : ""} · {flag.rule || flag.rule_id}
      </p>
    </div>
  );
}
