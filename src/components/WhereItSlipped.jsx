// "Where it slipped" card on Today: System map / Money journey views plus one pill per seam.
import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { seamLabel } from "@/components/systems.js";
import { seamFlowRows, seamFlowDefault } from "@/components/seamFlow.js";
import SeamSystemMap from "@/components/SeamSystemMap.jsx";
import MoneyJourney from "@/components/MoneyJourney.jsx";

const SLIPPED_VIEWS = [
  { id: "map", label: "System map" },
  { id: "journey", label: "Money journey" },
];

export default function WhereItSlipped({ flags, ruledCount, stages, onPicked }) {
  const { selectedSeam, setSelectedSeam } = useSelectedSeam();
  const [view, setView] = useState("map");
  const [hovered, setHovered] = useState(null);

  const rows = useMemo(() => seamFlowRows(flags), [flags]);
  const maxCents = useMemo(() => Math.max(1, ...rows.map((r) => r.cents)), [rows]);

  // Default selection: the seam with the most recoverable cents (also when the selected seam has closed).
  useEffect(() => {
    if (!rows.length) return;
    if (!selectedSeam || !rows.some((r) => r.seam === selectedSeam)) setSelectedSeam(seamFlowDefault(rows));
  }, [rows, selectedSeam, setSelectedSeam]);

  const activeSeam = hovered || selectedSeam;
  const pick = (seam) => {
    setSelectedSeam(seam);
    onPicked?.();
  };

  return (
    <section className="card rise flex flex-col p-5 lg:col-span-8" aria-label="Where it slipped">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold text-[#1C1917]">Where it slipped</h2>
        {rows.length ? (
          <div className="segmented" role="group" aria-label="Choose view">
            {SLIPPED_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="segmented-option"
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!rows.length ? (
        <p className="flex min-h-[260px] items-center justify-center text-center font-display text-[20px] text-[#1C1917]">
          Nothing slipped through. {ruledCount} look-alikes checked.
        </p>
      ) : (
        <>
          <div key={view} className="slip-visual rise mt-3">
            {view === "map" ? (
              <SeamSystemMap
                rows={rows}
                maxCents={maxCents}
                activeSeam={activeSeam}
                onHover={setHovered}
                onSelect={pick}
              />
            ) : (
              <MoneyJourney
                rows={rows}
                maxCents={maxCents}
                stages={stages}
                activeSeam={activeSeam}
                onHover={setHovered}
                onSelect={pick}
              />
            )}
          </div>

          <p className="slip-legend mt-2" aria-hidden="true">
            {rows.some((r) => !r.overdue && !r.creditOnly) ? <span><i className="legend-dot legend-owed" /> Owed to us</span> : null}
            {rows.some((r) => r.overdue) ? <span><i className="legend-dot legend-late" /> Late, not lost</span> : null}
            {rows.some((r) => r.creditOnly) ? <span><i className="legend-dot legend-credit" /> We owe customers</span> : null}
            <span>Click an amount to see its fixes</span>
          </p>
          <div className="slip-rows mt-3 flex flex-wrap gap-2" role="group" aria-label="Seams">
            {rows.map((r) => (
              <button
                key={r.seam}
                type="button"
                className="seam-chip"
                aria-pressed={selectedSeam === r.seam}
                onClick={() => pick(r.seam)}
                onMouseEnter={() => setHovered(r.seam)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(r.seam)}
                onBlur={() => setHovered(null)}
              >
                <span className="seam-chip-name">{seamLabel(r.seam)}</span>
                <span className="seam-chip-sep"> · </span>
                <span className="money">{fmt(r.cents)}{r.overdue ? " late" : r.creditOnly ? " we owe" : ""}</span>
                <span className="seam-chip-sep"> · </span>
                <span className="seam-chip-count">{r.n} finding{r.n === 1 ? "" : "s"}</span>
                <span className="seam-chip-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
