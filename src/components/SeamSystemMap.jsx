// System map: one SVG node per system, one connector per seam with open findings.
// Connector width scales with dollars; a dashed "drip" stroke animates along it.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";
import { SYSTEM_TINT, seamLabel } from "@/components/systems.js";
import { SEAM_FLOW_COLORS, SEAM_FLOW_OVERDUE_SEAM, seamFlowWidth, seamFlowTextWidth } from "@/components/seamFlow.js";

const SEAM_MAP_NEUTRAL = { bg: "#F1ECE4", ink: "#1C1917" };

// Fixed slots for known systems (130×50 each).
const SeamMapNodes = {
  CRM: { x: 40, y: 40, label: "CRM", sub: "contract prices", tint: SYSTEM_TINT.CRM },
  Warehouse: { x: 40, y: 200, label: "Warehouse", sub: "shipments", tint: SYSTEM_TINT.Warehouse },
  Billing: { x: 320, y: 120, label: "Billing", sub: "invoices", tint: SYSTEM_TINT.Billing },
  Cash: { x: 600, y: 120, label: "Cash in", sub: "", tint: SEAM_MAP_NEUTRAL },
  AP: { x: 320, y: 260, label: "AP", sub: "vendor bills", tint: SYSTEM_TINT.AP },
  Vendors: { x: 600, y: 260, label: "Vendors", sub: "", tint: SEAM_MAP_NEUTRAL },
};
const SeamMapSpareSlots = [
  { x: 40, y: 300 },
  { x: 600, y: 20 },
];
const SEAM_MAP_NODE_W = 130;
const SEAM_MAP_NODE_H = 50;

// Fixed connector geometry for known seams: path + label anchor.
const SeamMapPaths = {
  "CRM→Billing": { d: "M170 65 C 250 65, 250 145, 320 145", mid: [248.75, 105], lift: 0 },
  "Warehouse→Billing": { d: "M170 225 C 250 225, 250 145, 320 145", mid: [248.75, 185], lift: 0 },
  "Billing→Cash": { d: "M450 145 L600 145", mid: [525, 145], lift: 26 },
  "AP→Vendors": { d: "M450 285 L600 285", mid: [525, 285], lift: 26 },
};

/** Build node positions: registry nodes plus spare slots for unknown systems found in the seams. */
function seamMapLayout(rows) {
  const nodes = { ...SeamMapNodes };
  let spare = 0;
  for (const r of rows) {
    for (const name of [r.from, r.to]) {
      if (nodes[name] || spare >= SeamMapSpareSlots.length) continue;
      const slot = SeamMapSpareSlots[spare++];
      nodes[name] = { ...slot, label: name, sub: "", tint: SYSTEM_TINT[name] || SEAM_MAP_NEUTRAL, spare: true };
    }
  }
  const bottom = Math.max(...Object.values(nodes).map((n) => n.y + SEAM_MAP_NODE_H));
  return { nodes, height: Math.max(330, bottom + 20) };
}

/** Smooth cubic from the right edge of `a` to the left edge of `b`. */
function seamMapCurve(a, b) {
  const p0 = [a.x + SEAM_MAP_NODE_W, a.y + SEAM_MAP_NODE_H / 2];
  const p3 = [b.x, b.y + SEAM_MAP_NODE_H / 2];
  const p1 = [p0[0] + 60, p0[1]];
  const p2 = [p3[0] - 60, p3[1]];
  const mid = [
    (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8,
    (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8,
  ];
  return { d: `M${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`, mid, lift: 0 };
}

export function seamMapAriaLabel(rows) {
  return `System map of where money slipped: ${rows
    .map((r) => `${seamLabel(r.seam).replace("→", "to")} ${fmt(r.cents)}${r.overdue ? " late" : ""}, ${r.n} findings`)
    .join("; ")}.`;
}

export default function SeamSystemMap({ rows, maxCents, activeSeam, onHover, onSelect }) {
  const { nodes, height } = seamMapLayout(rows);

  return (
    <svg
      viewBox={`0 0 760 ${height}`}
      width="100%"
      role="img"
      aria-label={seamMapAriaLabel(rows)}
      className="block"
      onMouseLeave={() => onHover(null)}
    >
      {rows.map((r) => {
        const a = nodes[r.from];
        const b = nodes[r.to];
        if (!a || !b) return null;
        const known = SeamMapPaths[r.seam];
        const geo = known || seamMapCurve(a, b);
        const colors = r.seam === SEAM_FLOW_OVERDUE_SEAM ? SEAM_FLOW_COLORS.overdue : SEAM_FLOW_COLORS.owed;
        const text = `${fmt(r.cents)}${r.overdue ? " late" : ""}`;
        const w = seamFlowTextWidth(text) + 20;
        const cx = geo.mid[0];
        const cy = geo.mid[1] - geo.lift;
        const dim = activeSeam && activeSeam !== r.seam;
        return (
          <g
            key={r.seam}
            className="seam-conn"
            style={{ opacity: dim ? 0.35 : 1, cursor: "pointer" }}
            onMouseEnter={() => onHover(r.seam)}
            onClick={() => onSelect(r.seam)}
          >
            <path
              d={geo.d}
              fill="none"
              stroke={colors.soft}
              strokeWidth={seamFlowWidth(r.cents, maxCents)}
              strokeLinecap="round"
              strokeDasharray={known ? undefined : "10 6"}
              opacity={0.75}
            />
            <path
              className="seam-drip"
              d={geo.d}
              fill="none"
              stroke={colors.drip}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="3 15"
            />
            <path d={geo.d} fill="none" stroke="transparent" strokeWidth={28} pointerEvents="stroke" />
            <rect x={cx - w / 2} y={cy - 12} width={w} height={24} rx={12} fill="#FFFFFF" stroke="#E0D8CB" />
            <text
              x={cx}
              y={cy + 4.5}
              textAnchor="middle"
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
              fontSize="13"
              fontWeight="500"
              fill={colors.label}
            >
              {text}
            </text>
            {known ? null : (
              <g>
                <rect x={cx + w / 2 + 4} y={cy - 9} width={34} height={18} rx={9} fill="#1C1917" />
                <text
                  x={cx + w / 2 + 21}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontFamily="IBM Plex Sans, system-ui, sans-serif"
                  fontSize="10"
                  fontWeight="600"
                  fill="#FAF7F2"
                >
                  New
                </text>
              </g>
            )}
          </g>
        );
      })}

      {Object.entries(nodes).map(([key, n]) => (
        <g key={key}>
          <rect
            x={n.x}
            y={n.y}
            width={SEAM_MAP_NODE_W}
            height={SEAM_MAP_NODE_H}
            rx={14}
            fill={n.tint.bg}
            stroke={n.tint.ink}
            strokeOpacity={0.18}
          />
          <text
            x={n.x + SEAM_MAP_NODE_W / 2}
            y={n.sub ? n.y + 22 : n.y + 30}
            textAnchor="middle"
            fontFamily="IBM Plex Sans, system-ui, sans-serif"
            fontSize="14"
            fontWeight="600"
            fill={n.tint.ink}
          >
            {n.label}
          </text>
          {n.sub ? (
            <text
              x={n.x + SEAM_MAP_NODE_W / 2}
              y={n.y + 38}
              textAnchor="middle"
              fontFamily="IBM Plex Sans, system-ui, sans-serif"
              fontSize="11"
              fill={n.tint.ink}
              fillOpacity={0.8}
            >
              {n.sub}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
