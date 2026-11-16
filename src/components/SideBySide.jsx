// Proof panel: one column per system, the disagreeing field highlighted, then "how we caught it".
import React from "react";
const COLOR = { CRM: "bg-[#2F5BD3]", Warehouse: "bg-[#D9731A]", Billing: "bg-[#1F8A5B]", AP: "bg-[#7A4FC9]", Returns: "bg-[#5B5F68]" };
export default function SideBySide({ flag }) {
  return (
    <div className="mt-2 rounded border border-[#E2DDD2] bg-white p-3 text-sm">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${flag.evidence.length}, minmax(0,1fr))` }}>
        {flag.evidence.map((ev, i) => (
          <div key={i} className="rounded border border-[#E2DDD2] p-2">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#5B5F68]">
              <span className={`inline-block h-2 w-2 rounded-full ${COLOR[ev.system] || "bg-[#5B5F68]"}`} />{ev.system} · <span className="font-mono">{ev.id}</span>
            </div>
            {Object.entries(ev.fields).map(([k, v]) => (
              <div key={k} className={`flex justify-between font-mono text-xs ${k === flag.diff_field || (flag.diff_field === "qty" && k.includes("qty")) ? "rounded bg-red-50 font-semibold text-[#C22A25]" : ""}`}>
                <span className="text-[#5B5F68]">{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2">{flag.why}</p>
      <p className="mt-1 font-mono text-[11px] text-[#5B5F68]">{flag.seam} · confidence {flag.confidence} · key {flag.stable_key}</p>
    </div>
  );
}
