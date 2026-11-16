// Money journey: the customer money band with four gates, and tributaries where money leaks out.
// Paying vendors is a second, thinner band with its own tributary.
import React from "react";
import SeamConnector from "@/components/SeamConnector.jsx";
import { fmt } from "@/lib/engine/engine.js";
import { SYSTEM_TINT, seamLabel } from "@/components/systems.js";
import { SEAM_FLOW_COLORS, SEAM_FLOW_OVERDUE_SEAM, seamFlowWidth, seamFlowTextWidth } from "@/components/seamFlow.js";

const JOURNEY_BAND = { x: 40, y: 58, w: 1220, h: 34 };
const JOURNEY_VENDOR_BAND = { x: 40, y: 294, w: 1220, h: 14 };

// The 1300-wide view renders at about half size, so type is set larger than the map's.
const JOURNEY_TYPE = { band: 19, gate: 23, cardLabel: 19, cardAmount: 23 };

const JourneyGates = [
  { key: "contracted", label: "Contracted", x: 180, color: SYSTEM_TINT.CRM.ink },
  { key: "shipped", label: "Shipped", x: 500, color: SYSTEM_TINT.Warehouse.ink },
  { key: "invoiced", label: "Invoiced", x: 880, color: SYSTEM_TINT.Billing.ink },
  { key: "collected", label: "Collected", x: 1200, color: "#1C1917" },
];

// Where each tributary leaves its band, where it ends, and which side its card sits on.
const JourneyTributaries = {
  "Warehouse→Billing": { label: "Shipped, not billed", x0: 620, y0: JOURNEY_BAND.y + JOURNEY_BAND.h, x1: 655, y1: 150 },
  "CRM→Billing": { label: "Billed below contract", x0: 870, y0: JOURNEY_BAND.y + JOURNEY_BAND.h, x1: 915, y1: 236 },
  "Billing→Cash": { label: "Stuck: overdue", x0: 1095, y0: JOURNEY_BAND.y + JOURNEY_BAND.h, x1: 1100, y1: 150 },
  "AP→Vendors": { label: "Paid twice or over PO", x0: 440, y0: JOURNEY_VENDOR_BAND.y + JOURNEY_VENDOR_BAND.h, x1: 490, y1: 345 },
};

function journeyPath(t) {
  const dy = t.y1 - t.y0;
  return `M${t.x0} ${t.y0 - 6} C ${t.x0} ${t.y0 + dy * 0.6}, ${t.x0 + (t.x1 - t.x0) * 0.2} ${t.y1}, ${t.x1} ${t.y1}`;
}

export function journeyAriaLabel(rows) {
  const shown = rows.filter((r) => JourneyTributaries[r.seam]);
  return `Money journey from contract to cash: ${shown
    .map((r) => `${JourneyTributaries[r.seam].label} ${fmt(r.cents)}, ${r.n} findings`)
    .join("; ")}.`;
}

export default function MoneyJourney({ rows, maxCents, stages, activeSeam, onHover, onSelect }) {
  const shown = rows.filter((r) => JourneyTributaries[r.seam]);
  const vendorRow = shown.find((r) => r.seam === "AP→Vendors");
  const gates = JourneyGates.filter((g) => stages[g.key]);
  const hasCustomerBand = gates.length > 0 || shown.some((r) => r.seam !== "AP→Vendors");

  return (
    <svg
      viewBox="0 0 1300 380"
      width="100%"
      role="group"
      aria-label={journeyAriaLabel(rows)}
      className="block"
      onMouseLeave={() => onHover(null)}
    >
      {hasCustomerBand ? (
        <g>
          <text x={JOURNEY_BAND.x} y={22} fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize={JOURNEY_TYPE.band} letterSpacing="1.5" fill="#6B635A">
            SELLING TO CUSTOMERS
          </text>
          <rect {...{ x: JOURNEY_BAND.x, y: JOURNEY_BAND.y, width: JOURNEY_BAND.w, height: JOURNEY_BAND.h }} rx={17} fill="#E9F0EC" />
          {gates.map((g) => (
            <g key={g.key}>
              <line x1={g.x} x2={g.x} y1={JOURNEY_BAND.y - 8} y2={JOURNEY_BAND.y + JOURNEY_BAND.h + 8} stroke={g.color} strokeWidth={2} />
              <text
                x={g.x}
                y={JOURNEY_BAND.y - 14}
                textAnchor="middle"
                fontFamily="IBM Plex Sans, system-ui, sans-serif"
                fontSize={JOURNEY_TYPE.gate}
                fontWeight="600"
                fill="#1C1917"
              >
                {g.label}
              </text>
            </g>
          ))}
        </g>
      ) : null}

      {vendorRow ? (
        <g>
          <text x={JOURNEY_VENDOR_BAND.x} y={JOURNEY_VENDOR_BAND.y - 12} fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize={JOURNEY_TYPE.band} letterSpacing="1.5" fill="#6B635A">
            PAYING VENDORS
          </text>
          <rect
            x={JOURNEY_VENDOR_BAND.x}
            y={JOURNEY_VENDOR_BAND.y}
            width={JOURNEY_VENDOR_BAND.w}
            height={JOURNEY_VENDOR_BAND.h}
            rx={7}
            fill={SYSTEM_TINT.AP.bg}
          />
        </g>
      ) : null}

      {shown.map((r) => {
        const t = JourneyTributaries[r.seam];
        const d = journeyPath(t);
        const colors = r.seam === SEAM_FLOW_OVERDUE_SEAM ? SEAM_FLOW_COLORS.overdue : SEAM_FLOW_COLORS.owed;
        const amount = `${fmt(r.cents)} · ${r.n}`;
        const cardW = Math.max(seamFlowTextWidth(amount, JOURNEY_TYPE.cardAmount), t.label.length * JOURNEY_TYPE.cardLabel * 0.52) + 24;
        const cardH = 58;
        const strokeW = seamFlowWidth(r.cents, maxCents);
        const cardX = t.x1 + strokeW / 2 + 6;
        const cardY = t.y1 - cardH / 2;
        const dim = activeSeam && activeSeam !== r.seam;
        return (
          <SeamConnector
            key={r.seam}
            row={r} dim={dim} onHover={onHover} onSelect={onSelect}
            x={Math.min(1160, cardX + cardW / 2)} y={cardY}
          >
            <title>{`${seamLabel(r.seam)}: ${t.label}`}</title>
            <path d={d} fill="none" stroke={colors.soft} strokeWidth={strokeW} strokeLinecap="round" opacity={0.8} />
            <path className="seam-drip" d={d} fill="none" stroke={colors.drip} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 15" />
            <path d={d} fill="none" stroke="transparent" strokeWidth={28} pointerEvents="stroke" />
            <rect x={cardX} y={cardY} width={cardW} height={cardH} rx={12} fill="#FFFFFF" stroke="#E0D8CB" />
            <text x={cardX + 12} y={cardY + 22} fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize={JOURNEY_TYPE.cardLabel} fill="#6B635A">
              {t.label}
            </text>
            <text
              x={cardX + 12}
              y={cardY + 46}
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
              fontSize={JOURNEY_TYPE.cardAmount}
              fontWeight="500"
              fill={colors.label}
            >
              {amount}
            </text>
          </SeamConnector>
        );
      })}
    </svg>
  );
}
