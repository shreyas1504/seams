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

export default function WhereItSlipped({ flags, ruledCount, stages }) {
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

  return (
    <section className="card rise flex flex-col p-5 lg:col-span-8" aria-label="Where it slipped">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold text-ink">Where it slipped</h2>
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
        <p className="flex min-h-[260px] items-center justify-center text-center font-display text-[20px] text-ink">
          Nothing slipped through. {ruledCount} look-alikes checked.
        </p>
      ) : (
        <>
          <div key={view} className="rise mt-3">
            {view === "map" ? (
              <SeamSystemMap
                rows={rows}
                maxCents={maxCents}
                activeSeam={activeSeam}
                onHover={setHovered}
                onSelect={setSelectedSeam}
              />
            ) : (
              <MoneyJourney
                rows={rows}
                maxCents={maxCents}
                stages={stages}
                activeSeam={activeSeam}
                onHover={setHovered}
                onSelect={setSelectedSeam}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Seams">
            {rows.map((r) => (
              <button
                key={r.seam}
                type="button"
                className="seam-chip"
                aria-pressed={selectedSeam === r.seam}
                onClick={() => setSelectedSeam(r.seam)}
                onMouseEnter={() => setHovered(r.seam)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(r.seam)}
                onBlur={() => setHovered(null)}
              >
                {seamLabel(r.seam)} · <span className="money">{fmt(r.cents)}</span> · {r.n}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
