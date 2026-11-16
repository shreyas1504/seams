// System map: one SVG node per system, one connector per seam with open findings.
// Connectors run end to end in the gap between cards (never over them), ending in an arrowhead.
// Orange band = money owed to us; pink band = late, not lost. The drip animates only on the active seam.
import React from "react";
import SeamConnector from "@/components/SeamConnector.jsx";
import { fmt } from "@/lib/engine/engine.js";
import { SYSTEM_TINT, seamLabel } from "@/components/systems.js";
import { SEAM_FLOW_COLORS, SEAM_FLOW_OVERDUE_SEAM, seamFlowWidth, seamFlowTextWidth } from "@/components/seamFlow.js";

const SEAM_MAP_NEUTRAL = { bg: "#F1ECE4", ink: "#1C1917" };

// Fixed slots for known systems (130×50 each).
const SeamMapNodes = {
  CRM: { x: 40, y: 40, label: "CRM", sub: "contract prices", tint: SYSTEM_TINT.CRM },
  Warehouse: { x: 40, y: 200, label: "Warehouse", sub: "shipments", tint: SYSTEM_TINT.Warehouse },
  Billing: { x: 320, y: 120, label: "Billing", sub: "invoices", tint: SYSTEM_TINT.Billing },
  Cash: { x: 600, y: 120, label: "Cash in", sub: "customers pay", tint: SEAM_MAP_NEUTRAL },
  AP: { x: 320, y: 260, label: "AP", sub: "vendor bills", tint: SYSTEM_TINT.AP },
  Vendors: { x: 600, y: 260, label: "Vendors", sub: "we pay", tint: SEAM_MAP_NEUTRAL },
};
const SeamMapSpareSlots = [
  { x: 40, y: 300 },
  { x: 600, y: 20 },
  { x: 320, y: 0 },
];
const SEAM_MAP_NODE_W = 130;
const SEAM_MAP_NODE_H = 50;

// Fixed connector geometry for known seams: path + label anchor.
// Each band starts 8px after its source card and stops 12px before its target (room for the arrowhead).
// CRM and Warehouse enter Billing at separate ports so they never merge into one blob.
const SeamMapPaths = {
  "CRM→Billing": { d: "M178 65 C 250 65, 248 133, 308 133", mid: [243, 99], lift: 0 },
  "Warehouse→Billing": { d: "M178 225 C 250 225, 248 157, 308 157", mid: [243, 191], lift: 0 },
  "Billing→Cash": { d: "M458 145 L588 145", mid: [523, 145], lift: 26 },
  "AP→Vendors": { d: "M458 285 L588 285", mid: [523, 285], lift: 26 },
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
  const p0 = [a.x + SEAM_MAP_NODE_W + 8, a.y + SEAM_MAP_NODE_H / 2];
  const p3 = [b.x - 12, b.y + SEAM_MAP_NODE_H / 2];
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
    .map((r) => `${seamLabel(r.seam).replace("→", "to")} ${fmt(r.cents)}${r.overdue ? " late" : r.creditOnly ? " we owe" : ""}, ${r.n} findings`)
    .join("; ")}.`;
}

export default function SeamSystemMap({ rows, maxCents, activeSeam, onHover, onSelect }) {
  const { nodes, height } = seamMapLayout(rows);

  return (
    <svg
      viewBox={`0 0 760 ${height}`}
      width="100%"
      role="group"
      aria-label={seamMapAriaLabel(rows)}
      className="block"
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        {Object.entries(SEAM_FLOW_COLORS).map(([k, c]) => (
          <marker key={k} id={`seam-arrow-${k}`} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={c.drip} />
          </marker>
        ))}
      </defs>
      {rows.map((r) => {
        const a = nodes[r.from];
        const b = nodes[r.to];
        if (!a || !b) return null;
        const known = SeamMapPaths[r.seam];
        const geo = known || seamMapCurve(a, b);
        const colorKey = r.seam === SEAM_FLOW_OVERDUE_SEAM ? "overdue" : r.creditOnly ? "credit" : "owed";
        const colors = SEAM_FLOW_COLORS[colorKey];
        const active = activeSeam === r.seam;
        const text = `${fmt(r.cents)}${r.overdue ? " late" : r.creditOnly ? " we owe" : ""}`;
        const w = seamFlowTextWidth(text) + 20;
        const cx = geo.mid[0];
        const cy = geo.mid[1] - geo.lift;
        const dim = activeSeam && activeSeam !== r.seam;
        return (
          <SeamConnector
            key={r.seam}
            row={r} dim={dim} onHover={onHover} onSelect={onSelect}
            x={Math.max(125, Math.min(635, cx))} y={Math.max(78, cy)}
          >
            <path
              d={geo.d}
              fill="none"
              stroke={colors.soft}
              strokeWidth={seamFlowWidth(r.cents, maxCents) + (active ? 2 : 0)}
              strokeLinecap="butt"
            />
            <path
              className={active ? "seam-drip seam-drip--on" : "seam-drip"}
              d={geo.d}
              fill="none"
              stroke={colors.drip}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="3 15"
              markerEnd={`url(#seam-arrow-${colorKey})`}
            />
            <path d={geo.d} fill="none" stroke="transparent" strokeWidth={28} pointerEvents="stroke" />
            <rect className="seam-label-pill" x={cx - w / 2} y={cy - 13} width={w} height={26} rx={13} fill={active ? "#1C1917" : "#FFFFFF"} stroke={active ? "#1C1917" : colors.drip} strokeOpacity={active ? 1 : 0.45} strokeWidth={1.5} />
            <text
              x={cx}
              y={cy + 4.5}
              textAnchor="middle"
              fontFamily="Figtree, system-ui, sans-serif"
              fontSize="14"
              fontWeight="600"
              fill={active ? "#FFFFFF" : colors.label}
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
                  fontFamily="Figtree, system-ui, sans-serif"
                  fontSize="10"
                  fontWeight="600"
                  fill="#FAF7F2"
                >
                  New
                </text>
              </g>
            )}
          </SeamConnector>
        );
      })}
      {Object.entries(nodes).map(([key, n]) => (
        <g key={key}>
          <rect x={n.x} y={n.y} width={SEAM_MAP_NODE_W} height={SEAM_MAP_NODE_H} rx={14} fill={n.tint.bg} stroke={n.tint.ink} strokeOpacity={0.18} />
          <text x={n.x + SEAM_MAP_NODE_W / 2} y={n.sub ? n.y + 22 : n.y + 30} textAnchor="middle" fontFamily="Figtree, system-ui, sans-serif" fontSize="14" fontWeight="600" fill={n.tint.ink}>{n.label}</text>
          {n.sub ? <text x={n.x + SEAM_MAP_NODE_W / 2} y={n.y + 38} textAnchor="middle" fontFamily="Figtree, system-ui, sans-serif" fontSize="11" fill={n.tint.ink} fillOpacity={0.8}>{n.sub}</text> : null}
        </g>
      ))}

    </svg>
  );
}
