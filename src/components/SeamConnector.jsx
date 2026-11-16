import React, { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { seamLabel } from "@/components/systems.js";

export default function SeamConnector({ row, dim, onHover, onSelect, x, y, children }) {
  const [shown, setShown] = useState(false);
  const timer = useRef(null);
  const focused = useRef(false);
  const hovered = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const enter = () => {
    clearTimeout(timer.current);
    onHover(row.seam);
    timer.current = setTimeout(() => setShown(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
  };
  const leave = () => {
    if (focused.current || hovered.current) return;
    clearTimeout(timer.current); setShown(false); onHover(null);
  };
  const label = `${row.from} to ${row.to}, ${fmt(row.cents)}, ${row.n} findings`;
  return <g className="seam-conn" tabIndex={0} role="button" aria-label={label} aria-pressed={!dim}
    style={{ opacity: dim ? 0.35 : 1, cursor: "pointer" }}
    onMouseEnter={() => { hovered.current = true; enter(); }} onMouseLeave={() => { hovered.current = false; leave(); }}
    onFocus={() => { focused.current = true; enter(); }} onBlur={() => { focused.current = false; leave(); }}
    onClick={() => onSelect(row.seam)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row.seam); }
      if (e.key === "Escape") { clearTimeout(timer.current); setShown(false); }
    }}>
    {children}
    <g role="tooltip" aria-hidden={!shown} className="seam-tooltip" style={{ opacity: shown ? 1 : 0, pointerEvents: "none" }}>
      <rect x={x - 122} y={y - 70} width={244} height={57} rx={9} fill="#1C1917" />
      <text x={x} y={y - 51} textAnchor="middle" fill="#FAF7F2" fontSize={12}>{seamLabel(row.seam)} · {fmt(row.cents)}</text>
      <text x={x} y={y - 32} textAnchor="middle" fill="#FAF7F2" fontSize={11}>{row.n} findings · Click to see fixes</text>
    </g>
  </g>;
}
