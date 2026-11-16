// Receipt under a letter or refund: the records behind each line, in plain words.
// Import batches and row numbers (where a value came from) hide behind "Source rows".
import React, { useState } from "react";
import { displayText, plainFieldLabel } from "@/lib/displayText.js";
import { SBS_LINEAGE_KEYS } from "@/components/SideBySide.jsx";
import { openSeamsLookup } from "@/actions/dataChanged.js";

export default function SettleReceipt({ receipt }) {
  const [showSource, setShowSource] = useState(false);
  const rows = receipt || [];
  const hasSource = rows.some((r) => Object.keys(r.fields || {}).some((k) => SBS_LINEAGE_KEYS.has(k)));
  return (
    <section className="seams-settle-sheet__receipt-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="seams-settle-sheet__receipt-title">Receipt · the records behind each line</h3>
        {hasSource ? (
          <button type="button" className="fix-quiet" aria-expanded={showSource} onClick={() => setShowSource((v) => !v)}>
            {showSource ? "Hide source rows" : "Source rows"}
          </button>
        ) : null}
      </div>
      <div className="seams-settle-sheet__receipt-wrap">
        <table className="seams-settle-sheet__receipt">
          <thead>
            <tr>
              <th>System</th>
              <th>Record</th>
              <th>Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const fields = Object.entries(r.fields || {});
              const plain = fields.filter(([k]) => !SBS_LINEAGE_KEYS.has(k));
              const source = fields.filter(([k]) => SBS_LINEAGE_KEYS.has(k));
              return (
                <tr key={i}>
                  <td>{r.system}</td>
                  <td>
                    {r.id && r.id !== "—" ? (
                      <button type="button" className="record-link" onClick={() => openSeamsLookup(r.id)}>
                        {r.id}
                      </button>
                    ) : (
                      "no record"
                    )}
                  </td>
                  <td>
                    {plain.map(([k, v]) => `${plainFieldLabel(k)} ${displayText(v)}`).join(" · ")}
                    {showSource && source.length ? (
                      <span className="block text-[11px] text-[#6B635A]">{source.map(([k, v]) => `${k === "source_row" ? "row" : "batch"} ${v}`).join(" · ")}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
