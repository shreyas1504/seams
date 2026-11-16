// One small chart under the proof, chosen by the finding's rule, drawn from the finding's own records.
// Hand-built SVG (no chart library), so it transfers to Base44 unchanged.
import React from "react";
import { fmt, toCents } from "@/lib/engine/engine.js";
import { displayDate } from "@/lib/displayText.js";

const FC = { ink: "#1C1917", muted: "#6B635A", line: "#ECE4D8", owed: "#C2410C", owedSoft: "#F6D9C8", late: "#9F1239", lateSoft: "#F5D5DD", ok: "#1F4D3A", okSoft: "#D8E6DE" };
const FC_W = 560;
const FC_FONT = "Figtree, system-ui, sans-serif";

const fcDay = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime() / 86400000;
};
const fcField = (flag, system, key) => {
  for (const e of flag.evidence || []) if (!system || e.system === system) if (e.fields?.[key] != null && e.fields[key] !== "") return e.fields[key];
  return null;
};

function FcFrame({ title, caption, height = 120, label, children }) {
  return (
    <figure className="finding-chart" aria-label={label}>
      <figcaption className="finding-chart__title">{title}</figcaption>
      <svg viewBox={`0 0 ${FC_W} ${height}`} width="100%" role="img" aria-label={label} style={{ fontFamily: FC_FONT }}>
        {children}
      </svg>
      {caption ? <p className="finding-chart__caption">{caption}</p> : null}
    </figure>
  );
}

/** Paid twice: two payments of the same bill on a timeline, bracketed. */
function FcPaidTwice({ flag }) {
  const pays = (flag.evidence || []).filter((e) => e.fields?.paid).map((e) => ({ id: e.fields.invoice_no || e.id, day: fcDay(e.fields.paid), date: e.fields.paid, cents: toCents(e.fields.amount) }));
  if (pays.length < 2 || pays.some((p) => p.day == null)) return null;
  pays.sort((a, b) => a.day - b.day);
  const lo = pays[0].day - 10, hi = pays[pays.length - 1].day + 10;
  const x = (d) => 40 + ((d - lo) / (hi - lo)) * (FC_W - 80);
  const gap = Math.round(pays[pays.length - 1].day - pays[0].day);
  return (
    <FcFrame title="Same bill, paid twice" label={`Paid ${fmt(pays[0].cents)} on ${displayDate(pays[0].date)} and again on ${displayDate(pays[1].date)}, ${gap} days apart`} caption={`${gap} days apart, same amount, invoice number written two ways.`}>
      <line x1="30" x2={FC_W - 30} y1="78" y2="78" stroke={FC.line} strokeWidth="2" />
      <path d={`M${x(pays[0].day)} 46 V36 H${x(pays[1].day)} V46`} fill="none" stroke={FC.owed} strokeWidth="1.5" />
      <text x={(x(pays[0].day) + x(pays[1].day)) / 2} y="28" textAnchor="middle" fontSize="12" fontWeight="600" fill={FC.owed}>{`${gap} days · ${fmt(pays[1].cents)} paid again`}</text>
      {pays.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.day)} cy="78" r="9" fill={i ? FC.owed : FC.ink} />
          <text x={x(p.day)} y="104" textAnchor="middle" fontSize="12" fill={FC.ink}>{`${p.id} · ${displayDate(p.date)}`}</text>
          <text x={x(p.day)} y="60" textAnchor="middle" fontSize="12" fontWeight="600" fill={i ? FC.owed : FC.ink}>{fmt(p.cents)}</text>
        </g>
      ))}
    </FcFrame>
  );
}

/** Two horizontal bars: what was allowed vs what happened, with the difference highlighted. */
function FcBars({ title, label, caption, a, b, unit = "money" }) {
  const max = Math.max(a.v, b.v, 1);
  const w = (v) => (v / max) * (FC_W - 190);
  const show = (v) => (unit === "money" ? fmt(v) : `${v} units`);
  const over = b.v - a.v;
  return (
    <FcFrame title={title} label={label} caption={caption} height={104}>
      {[a, b].map((r, i) => (
        <g key={i} transform={`translate(0 ${18 + i * 42})`}>
          <text x="0" y="17" fontSize="12" fill={FC.muted}>{r.name}</text>
          {r.dashed ? (
            <rect x="96" y="2" width={FC_W - 190} height="22" rx="6" fill="none" stroke={FC.owed} strokeDasharray="5 5" />
          ) : (
            <rect x="96" y="2" width={Math.max(2, w(r.v))} height="22" rx="6" fill={i ? FC.owedSoft : FC.okSoft} />
          )}
          {i && over > 0 && !r.dashed ? <rect x={96 + w(a.v)} y="2" width={Math.max(3, w(over))} height="22" rx="4" fill={FC.owed} /> : null}
          <text x={r.dashed ? 106 : 96 + Math.max(2, w(r.v)) + 8} y="18" fontSize="12" fontWeight="600" fill={r.dashed ? FC.owed : FC.ink}>
            {r.dashed ? r.dashLabel : show(r.v)}
          </text>
        </g>
      ))}
    </FcFrame>
  );
}

/** Price not updated: contract price steps on its start date; invoice dots below it are the leak. */
function FcPrice({ flag, flags, invoices }) {
  const sku = fcField(flag, "Billing", "sku");
  const contract = toCents(fcField(flag, "CRM", "price"));
  const from = fcField(flag, "CRM", "from");
  if (!sku || !contract) return null;
  const rows = (invoices || [])
    .filter((r) => r.customer === flag.party && r.sku === sku && fcDay(r.invoice_date) != null)
    .map((r) => ({ id: r.invoice_no, day: fcDay(r.invoice_date), date: r.invoice_date, cents: toCents(r.unit_price) }))
    .sort((p, q) => p.day - q.day);
  if (!rows.length) return null;
  const flagged = new Set(flags.filter((f) => f.rule_id === flag.rule_id && f.party === flag.party).flatMap((f) => f.ids || []));
  const fromDay = fcDay(from);
  const before = rows.filter((r) => fromDay != null && r.day < fromDay).map((r) => r.cents);
  const old = before.length ? before[before.length - 1] : null;
  // Show the price change only when it happened near these invoices; otherwise just the contract line.
  const showChange = fromDay != null && old != null && rows[0].day - fromDay < 60;
  const lo = Math.min(rows[0].day, showChange ? fromDay : rows[0].day) - 12, hi = rows[rows.length - 1].day + 12;
  const vals = [contract, old, ...rows.map((r) => r.cents)].filter((v) => v != null);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const pad = Math.max(50, (vmax - vmin) * 0.35);
  const x = (d) => 60 + ((d - lo) / (hi - lo)) * (FC_W - 90);
  const y = (c) => 100 - ((c - (vmin - pad)) / (vmax + pad - (vmin - pad))) * 80;
  const fx = showChange ? x(fromDay) : 60;
  const bad = rows.filter((r) => flagged.has(r.id));
  return (
    <FcFrame
      title={`${sku} price per unit, ${flag.party}`}
      height={132}
      label={`Contract price ${fmt(contract)} from ${displayDate(from)}; ${bad.length} invoices billed at the old price`}
      caption={showChange ? `Contract moved to ${fmt(contract)} on ${displayDate(from)}; ${bad.length} invoice${bad.length === 1 ? "" : "s"} after it still used ${fmt(old)}.` : `Contract price ${fmt(contract)}; red dots are invoices billed ${flag.rule_id === "below_contract" ? "below" : "above"} it.`}
    >
      {showChange ? <line x1="60" x2={fx} y1={y(old)} y2={y(old)} stroke={FC.muted} strokeWidth="2" strokeDasharray="4 4" /> : null}
      {showChange ? <line x1={fx} x2={fx} y1={y(old)} y2={y(contract)} stroke={FC.ok} strokeWidth="2" /> : null}
      <line x1={fx} x2={FC_W - 30} y1={y(contract)} y2={y(contract)} stroke={FC.ok} strokeWidth="2.5" />
      <text x={FC_W - 30} y={y(contract) - 6} textAnchor="end" fontSize="12" fontWeight="600" fill={FC.ok}>{`Contract ${fmt(contract)}`}</text>
      {showChange ? <text x={fx} y="126" textAnchor="middle" fontSize="11" fill={FC.muted}>{`Price change ${displayDate(from)}`}</text> : null}
      {bad.map((r) => <line key={`g${r.id}`} x1={x(r.day)} x2={x(r.day)} y1={y(r.cents)} y2={y(contract)} stroke={FC.owed} strokeWidth="6" opacity="0.25" />)}
      {rows.map((r) => (
        <circle key={r.id} cx={x(r.day)} cy={y(r.cents)} r="5.5" fill={flagged.has(r.id) ? FC.owed : "#fff"} stroke={flagged.has(r.id) ? FC.owed : FC.muted} strokeWidth="1.5">
          <title>{`${r.id} ${displayDate(r.date)} ${fmt(r.cents)}`}</title>
        </circle>
      ))}
      {showChange ? <text x="60" y={y(old) + 18} fontSize="11" fill={FC.muted}>{`Old ${fmt(old)}`}</text> : null}
      {bad.length ? (
        <text x="60" y="16" fontSize="12" fontWeight="600" fill={FC.owed}>
          {`${bad.length} invoice${bad.length === 1 ? "" : "s"} ${showChange ? "still at the old price" : flag.rule_id === "below_contract" ? "below contract" : "above contract"}`}
        </text>
      ) : null}
    </FcFrame>
  );
}

/** Overdue: aging bar with terms and the invoice's position. */
function FcAging({ flag }) {
  const m = String(flag.why || "").match(/still open (\d+) days later/);
  const days = m ? Number(m[1]) : null;
  if (days == null) return null;
  const max = Math.max(110, days + 15);
  const x = (d) => 20 + (Math.min(d, max) / max) * (FC_W - 40);
  const bands = [[0, 30, "#EEF2EC", "0–30"], [30, 60, "#FBEDE3", "30–60"], [60, 90, "#F8E0E5", "60–90"], [90, max, "#F2CCD5", "90+"]];
  return (
    <FcFrame title="How late is it" label={`${days} days past due`} caption={`${fmt(flag.amount_cents)} is ${days} days past due. Late, not lost: chase it before it ages further.`} height={96}>
      {bands.map(([a, b, c, t]) => (
        <g key={t}>
          <rect x={x(a)} y="30" width={x(b) - x(a)} height="24" fill={c} />
          <text x={(x(a) + x(b)) / 2} y="72" textAnchor="middle" fontSize="11" fill={FC.muted}>{t}</text>
        </g>
      ))}
      <text x="20" y="20" fontSize="11" fill={FC.muted}>Days past due</text>
      <line x1={x(days)} x2={x(days)} y1="22" y2="62" stroke={FC.late} strokeWidth="3" />
      <circle cx={x(days)} cy="42" r="7" fill={FC.late} />
      <text x={x(days)} y="90" textAnchor="middle" fontSize="12" fontWeight="600" fill={FC.late}>{`${days} days`}</text>
    </FcFrame>
  );
}

export default function FindingChart({ flag, flags = [], invoices = [] }) {
  if (!flag) return null;
  const r = flag.rule_id;
  if (r === "dup_payment") return <FcPaidTwice flag={flag} />;
  if (r === "over_po") {
    const po = toCents(fcField(flag, null, "po_amount"));
    const bill = toCents(fcField(flag, null, "amount"));
    if (!po || !bill) return null;
    return <FcBars title="Billed vs approved PO" label={`PO ${fmt(po)}, billed ${fmt(bill)}`} caption={`${fmt(bill - po)} over the approved PO.`} a={{ name: "PO approved", v: po }} b={{ name: "Billed", v: bill }} />;
  }
  if (r === "below_contract" || r === "above_contract") return <FcPrice flag={flag} flags={flags} invoices={invoices} />;
  if (r === "unbilled") {
    const qty = Number(fcField(flag, "Warehouse", "qty")) || 0;
    if (!qty) return null;
    return <FcBars title="Shipped vs invoiced" unit="qty" label={`${qty} units shipped, no invoice`} caption={`Shipped ${displayDate(fcField(flag, "Warehouse", "ship_date"))}; no invoice exists for it.`} a={{ name: "Shipped", v: qty }} b={{ name: "Invoiced", v: qty, dashed: true, dashLabel: "none found" }} />;
  }
  if (r === "short_billed") {
    const shipped = Number(fcField(flag, "Warehouse", "qty")) || 0;
    const billed = Number(fcField(flag, "Billing", "qty")) || 0;
    if (!shipped) return null;
    return <FcBars title="Shipped vs billed units" unit="qty" label={`${shipped} shipped, ${billed} billed`} caption={`${shipped - billed} units shipped but never billed.`} a={{ name: "Billed", v: billed }} b={{ name: "Shipped", v: shipped }} />;
  }
  if (r === "freight") {
    const cost = toCents(fcField(flag, "Warehouse", "freight_cost"));
    const billed = toCents(fcField(flag, "Billing", "freight_billed"));
    if (!cost) return null;
    return <FcBars title="Freight paid vs rebilled" label={`Freight cost ${fmt(cost)}, rebilled ${fmt(billed)}`} caption="The contract says rebill freight; it was not passed on." a={{ name: "Rebilled", v: billed }} b={{ name: "Freight cost", v: cost }} />;
  }
  if (r === "overdue") return <FcAging flag={flag} />;
  return null;
}
