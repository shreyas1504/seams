// Today, kit mode, in the original Seams layout: morning brief + fix tracker | Where it slipped,
// then Today's fixes (one clickable tile per cause) | Proof · Trace with a small chart.
// Every dollar is summed from findings.csv rows, so the app's totals match the submitted file.
import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { seamLabel, SYSTEM_TINT } from "@/components/systems.js";
import WhereItSlipped from "@/components/WhereItSlipped.jsx";
import { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import FixDrawer from "@/components/FixDrawer.jsx";
import { useKitFlags, kitMonthTotals, kitWhatChanged } from "@/lib/kitData.js";
import { displayText } from "@/lib/displayText.js";
import { openSeamsLookup } from "@/actions/dataChanged.js";

const KIT_MONTH_LABEL = { september: "Sep", october: "Oct" };
const kitSum = (fs) => fs.reduce((a, f) => a + f.signed_cents, 0);
const kitMoney = (c) => (c < 0 ? `${fmt(-c)} we owe` : c === 0 ? "No $" : fmt(c));
const kitTone = (c) => (c < 0 ? "#0F766E" : c === 0 ? "#57534E" : "#C2410C");
const KC = { ink: "#1C1917", muted: "#6B635A", line: "#ECE4D8", owed: "#C2410C", owedSoft: "#F6D9C8", ok: "#1F4D3A", okSoft: "#D8E6DE", teal: "#0F766E" };

/** First number in a string: "$1,234.50" -> 1234.5, "8 cases" -> 8. */
function kitNum(s) {
  const m = String(s || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** What the finding's records say vs what the rule says, read from evidence.csv. */
function kitCompare(flag) {
  const ev = flag.evidence || [];
  const p = flag.rule || "";
  if (/never invoiced/i.test(p)) return { a: ["Delivered", Math.abs(flag.signed_cents) / 100], b: ["Invoiced", 0], money: true, caption: "Goods arrived; no invoice exists for them." };
  if (/invoiced twice|entered twice/i.test(p)) return { a: ["First", Math.abs(flag.signed_cents) / 100], b: ["Second copy", Math.abs(flag.signed_cents) / 100], money: true, caption: "Same goods billed twice; only one should stand.", dup: true };
  if (/no reply|bank/i.test(p)) return null;
  const row = ev.find((e) => e.fields.expected && kitNum(e.fields.shows) != null && kitNum(e.fields.expected) != null);
  if (!row) return null;
  const money = /\$/.test(row.fields.shows + row.fields.expected);
  return { a: ["Records show", kitNum(row.fields.shows)], b: ["Rule says", kitNum(row.fields.expected)], money, caption: `${displayText(row.fields.shows)} · rule: ${displayText(row.fields.expected)}` };
}

/** Bank change: the account on file next to the account the bill pays into. */
function KitAccounts({ flag }) {
  const digits = (flag.evidence || []).map((e) => String(e.fields.shows || "").match(/\.{3}(\d{4})/)?.[1]).filter(Boolean);
  if (digits.length < 2) return null;
  const [remit, onFile] = digits;
  return (
    <figure className="finding-chart" aria-label={`Bill pays into account ending ${remit}; account on file ends ${onFile}`}>
      <figcaption className="finding-chart__title">Where the money would go</figcaption>
      <div className="grid grid-cols-2 gap-3 py-1">
        <div><p className="text-[11px] text-[#6B635A]">Bill pays into</p><p className="money text-[22px] font-semibold text-[#C2410C]">•••• {remit}</p></div>
        <div><p className="text-[11px] text-[#6B635A]">Account on file</p><p className="money text-[22px] font-semibold text-[#1F4D3A]">•••• {onFile}</p></div>
      </div>
      <p className="finding-chart__caption">Hold payment and call the supplier at the number on file before paying.</p>
    </figure>
  );
}

function KitBars({ flag }) {
  if (/bank/i.test(flag.rule || "")) return <KitAccounts flag={flag} />;
  const c = kitCompare(flag);
  if (!c) return null;
  const W = 520, max = Math.max(Math.abs(c.a[1]), Math.abs(c.b[1]), 0.01);
  const w = (v) => Math.max(2, (Math.abs(v) / max) * (W - 200));
  const show = (v) => (c.money ? fmt(Math.round(v * 100)) : `${v} cases`);
  const diff = c.a[1] !== c.b[1];
  return (
    <figure className="finding-chart" aria-label={`${c.a[0]} ${show(c.a[1])}, ${c.b[0]} ${show(c.b[1])}`}>
      <figcaption className="finding-chart__title">{c.dup ? "Billed twice" : "Records vs the rule"}</figcaption>
      <svg viewBox={`0 0 ${W} 84`} width="100%" role="img" style={{ fontFamily: "Figtree, system-ui, sans-serif" }}>
        {[c.a, c.b].map(([name, v], i) => (
          <g key={name} transform={`translate(0 ${10 + i * 36})`}>
            <text x="0" y="17" fontSize="12" fill={KC.muted}>{name}</text>
            <rect x="96" y="4" width={w(v)} height="18" rx="4" fill={i === 0 ? (diff || c.dup ? KC.owed : KC.ok) : KC.okSoft} stroke={i === 1 && v === 0 ? KC.muted : "none"} strokeDasharray={i === 1 && v === 0 ? "4 3" : undefined} />
            <text x={96 + w(v) + 8} y="18" fontSize="12.5" fontWeight="600" fill={KC.ink}>{v === 0 && !c.money ? "0 cases" : show(v)}</text>
          </g>
        ))}
      </svg>
      <p className="finding-chart__caption">{c.caption}</p>
    </figure>
  );
}

/** The selected line inside its cause: one column per line, biggest first, the open one highlighted. */
function KitCauseSpark({ flag, rows }) {
  if (!rows || rows.length < 2) return null;
  const top = rows.slice(0, 40);
  const W = 520, H = 70, max = Math.max(...top.map((r) => Math.abs(r.signed_cents)), 1);
  const bw = Math.min(22, (W - 20) / top.length - 2);
  return (
    <figure className="finding-chart" aria-label={`${rows.length} lines share this cause`}>
      <figcaption className="finding-chart__title">Same cause · {rows.length} lines · {kitMoney(kitSum(rows))}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ fontFamily: "Figtree, system-ui, sans-serif" }}>
        <line x1="0" x2={W} y1={H - 4} y2={H - 4} stroke={KC.line} />
        {top.map((r, i) => {
          const h = Math.max(3, (Math.abs(r.signed_cents) / max) * (H - 14));
          const on = r.stable_key === flag.stable_key;
          return <rect key={r.stable_key} x={10 + i * (bw + 2)} y={H - 4 - h} width={bw} height={h} rx="2" fill={on ? KC.ink : r.signed_cents < 0 ? "#B9DAD3" : KC.owedSoft} />;
        })}
      </svg>
      <p className="finding-chart__caption">This line is the dark bar. Fixing the cause clears all {rows.length}.</p>
    </figure>
  );
}

/** When the cause's lines happened: one dot per line on a day axis, the open line dark, first day marked. */
function KitTimeline({ flag, rows }) {
  const dated = rows.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(r.date || ""));
  if (!dated.length) return null;
  const day = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000;
  const days = dated.map((r) => day(r.date));
  const lo = Math.min(...days) - 1, hi = Math.max(...days) + 1, span = Math.max(hi - lo, 7);
  const W = 520, x = (d) => 16 + ((d - lo) / span) * (W - 32);
  const first = dated.reduce((a, r) => (r.date < a.date ? r : a), dated[0]);
  const fmtDay = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const stack = new Map();
  return (
    <figure className="finding-chart" aria-label={`${dated.length} lines between ${fmtDay(first.date)} and ${fmtDay(dated.reduce((a, r) => (r.date > a ? r.date : a), first.date))}`}>
      <figcaption className="finding-chart__title">When it happened · first seen {fmtDay(first.date)}</figcaption>
      <svg viewBox={`0 0 ${W} 86`} width="100%" role="img" style={{ fontFamily: "Figtree, system-ui, sans-serif" }}>
        <line x1="10" x2={W - 10} y1="62" y2="62" stroke={KC.line} strokeWidth="2" />
        <line x1={x(day(first.date))} x2={x(day(first.date))} y1="14" y2="66" stroke={KC.owed} strokeDasharray="3 3" />
        {dated.map((r) => {
          const k = Math.round(x(day(r.date)));
          const n = stack.get(k) || 0; stack.set(k, n + 1);
          const on = r.stable_key === flag.stable_key;
          return <circle key={r.stable_key} cx={k} cy={54 - Math.min(n, 5) * 9} r={on ? 5.5 : 4} fill={on ? KC.ink : r.signed_cents < 0 ? "#7FBFB3" : "#E9A985"} />;
        })}
        <text x="10" y="80" fontSize="11" fill={KC.muted}>{fmtDay(new Date(lo * 86400000 + 86400000).toISOString())}</text>
        <text x={W - 10} y="80" fontSize="11" textAnchor="end" fill={KC.muted}>{fmtDay(new Date(hi * 86400000 - 86400000).toISOString())}</text>
        <text x={Math.min(W - 60, x(day(first.date)) + 6)} y="12" fontSize="11" fill={KC.owed}>started</text>
      </svg>
      <p className="finding-chart__caption">{dated.length} {dated.length === 1 ? "line" : "lines"}; the open one is dark. Everything after the dashed line repeats the same cause.</p>
    </figure>
  );
}

/** Who the cause hits: top customers or suppliers by dollars. */
function KitWho({ rows }) {
  const by = new Map();
  for (const r of rows) by.set(r.party || "Unknown", (by.get(r.party || "Unknown") || 0) + r.signed_cents);
  const top = [...by.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
  if (top.length < 2) return null;
  const max = Math.max(...top.map(([, c]) => Math.abs(c)), 1);
  return (
    <figure className="finding-chart" aria-label={`Top ${top.length} affected`}>
      <figcaption className="finding-chart__title">Who it hits · {by.size} {by.size === 1 ? "account" : "accounts"}</figcaption>
      <ul className="mt-1 grid gap-1.5">
        {top.map(([name, c]) => (
          <li key={name} className="grid items-center gap-2 text-[12.5px]" style={{ gridTemplateColumns: "minmax(0,150px) 1fr auto" }}>
            <span className="truncate text-[#44403C]">{name}</span>
            <span className="h-[7px] rounded-full bg-[#F1ECE4]"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(c) / max) * 100)}%`, background: kitTone(c), opacity: 0.8 }} /></span>
            <span className="money font-semibold" style={{ color: kitTone(c) }}>{c === 0 ? "$0" : fmt(c)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function KitProofStep({ dot, label, last, children }) {
  return (
    <li className="relative pl-6">
      {last ? null : <span className="proof-line" aria-hidden />}
      <span className="proof-dot" style={{ background: dot }} aria-hidden />
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#6B635A]">{label}</p>
      <div className="mt-1">{children}</div>
    </li>
  );
}

function KitProof({ flag, causeRows, onDraft }) {
  if (!flag) {
    return (
      <section className="card rise flex min-h-[220px] items-center justify-center p-5 lg:col-span-6" aria-label="Proof trace">
        <p className="text-[13px] text-[#6B635A]">Pick a finding to see its proof.</p>
      </section>
    );
  }
  const stamp = flag.status === "sent" ? "APPROVED" : flag.status === "dismissed" ? "DISMISSED" : "OPEN";
  return (
    <section className="card rise self-start p-5 lg:sticky lg:top-20 lg:col-span-6" aria-label="Proof trace">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6B635A]">Proof · Trace</p>
        <span className={`fix-stamp ${flag.status === "sent" ? "fix-stamp-sent" : ""}`}>{stamp}</span>
      </div>
      <ol className="mt-4 space-y-4">
        <KitProofStep dot="#C2410C" label="Finding">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[17px] font-semibold leading-snug text-[#1C1917]">{flag.title}</h3>
            <span className="money text-[16px] font-semibold" style={{ color: flag.signed_cents < 0 ? KC.teal : KC.ink }}>{flag.signed_cents === 0 ? "$0.00" : fmt(flag.signed_cents)}</span>
          </div>
          <p className="mt-1 text-[13px] text-[#44403C]">{displayText(flag.why)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(flag.idFields).map(([k, v]) => (
              <button key={k} type="button" className="record-chip" onClick={() => openSeamsLookup(v)}>{k.replace("_", " ")} {v}</button>
            ))}
          </div>
        </KitProofStep>
        <KitProofStep dot="#1F4D3A" label="Root cause">
          <p className="text-[13px] text-[#1C1917]">{flag.cause}{causeRows.length > 1 ? ` · ${causeRows.length} lines, ${kitMoney(kitSum(causeRows))}` : ""}</p>
        </KitProofStep>
        <KitProofStep dot="#1C1917" label="Records side by side">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(flag.evidence.length, 1), 2)}, minmax(0, 1fr))` }}>
            {flag.evidence.map((e, i) => (
              <div key={i} className={`proof-record${e.fields.expected ? " is-diff" : ""}`}>
                <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B635A]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: SYSTEM_TINT[e.system]?.ink || KC.muted }} aria-hidden />
                  {e.system} · {e.file}
                </p>
                <p className="mt-1 text-[11.5px] text-[#6B635A]">{displayText(e.id)}</p>
                <p className="proof-value text-[13.5px] font-medium text-[#1C1917]">{displayText(e.fields.shows)}</p>
                {e.fields.expected ? <p className="mt-1 text-[12px] font-medium text-[#C2410C]">Rule says: {displayText(e.fields.expected)}</p> : null}
              </div>
            ))}
          </div>
        </KitProofStep>
        <KitProofStep dot="#A8A29E" label="Picture">
          <KitBars flag={flag} />
          <KitCauseSpark flag={flag} rows={causeRows} />
        </KitProofStep>
        <KitProofStep dot="#C2410C" label="Pattern" last>
          <KitTimeline flag={flag} rows={causeRows} />
          <KitWho rows={causeRows} />
        </KitProofStep>
      </ol>
      {flag.decision ? (
        <p className="mt-4 text-[12px] text-[#6B635A]">
          {flag.decision.status === "approved" ? "Approved" : "Dismissed"} by {flag.decision.decided_by} · {String(flag.decision.decided_at || "").slice(0, 16).replace("T", " ")}
          {flag.decision.reason ? ` · ${flag.decision.reason}` : ""}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {flag.status === "open" ? <button type="button" className="fix-pill" onClick={() => onDraft([flag])}>Draft fix for this line</button> : null}
        <span className="chip chip-neutral">Amount from our code, not AI</span>
        <span className="chip chip-neutral">Same row as findings.csv</span>
      </div>
    </section>
  );
}

/** One clickable tile per cause. Picking it opens its lines and shows the biggest one in the proof. */
function KitCauseTile({ cause, rows, seamMax, active, selectedKey, onPick, onSelect, onDraft }) {
  const total = kitSum(rows);
  const pct = Math.max(4, Math.round((Math.abs(total) / Math.max(seamMax, 1)) * 100));
  const months = new Set(rows.map((r) => r.month));
  return (
    <li className={`kit-tile${active ? " is-active" : ""}`}>
      <button type="button" className="kit-tile__head" aria-expanded={active} onClick={() => onPick(cause, rows)}>
        <span className="min-w-0">
          <span className="kit-tile__title">{cause}</span>
          <span className="kit-tile__meta">
            {rows[0].rule} · {rows.length} {rows.length === 1 ? "line" : "lines"}
            {months.has("october") ? (months.has("september") ? " · still open in Oct" : " · new in Oct") : ""}
          </span>
          <span className="kit-tile__bar" aria-hidden><span style={{ width: `${pct}%`, background: kitTone(total) }} /></span>
        </span>
        <span className="money kit-tile__amt" style={{ color: kitTone(total) }}>{total === 0 ? `${rows.length} to act on` : kitMoney(total)}</span>
      </button>
      {active ? (
        <div className="kit-tile__body">
          <ul>
            {rows.slice(0, 12).map((f) => (
              <li key={f.stable_key}>
                <button type="button" className="kit-line" aria-pressed={selectedKey === f.stable_key} onClick={() => onSelect(f)}>
                  <span className="kit-line__ids">{f.ids.join(" · ")}</span>
                  <span className="kit-line__party">{f.party}</span>
                  <span className="money kit-line__amt" style={{ color: f.signed_cents < 0 ? KC.teal : KC.ink }}>{f.signed_cents === 0 ? "$0.00" : fmt(f.signed_cents)}</span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length > 12 ? <p className="mt-1 text-[11.5px] text-[#6B635A]">+{rows.length - 12} more lines in the draft</p> : null}
          {rows.some((r) => r.status === "open") ? (
            <button type="button" className="fix-pill mt-2" onClick={() => onDraft(rows.filter((r) => r.status === "open"))}>
              Draft fix · {rows.filter((r) => r.status === "open").length} {rows.length === 1 ? "line" : "lines"}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function KitToday({ role, onGoData }) {
  const [flags, , meta, { decisions }] = useKitFlags();
  const { selectedSeam, selectedFlagKey, setSelectedFlagKey } = useSelectedSeam();
  const [drafting, setDrafting] = useState(null);
  const [filter, setFilter] = useState("open");
  const [activeCause, setActiveCause] = useState(null);
  const [allCauses, setAllCauses] = useState(false);

  const open = useMemo(() => flags.filter((f) => f.status === "open"), [flags]);
  const months = useMemo(() => kitMonthTotals(flags), [flags]);
  const changed = useMemo(() => kitWhatChanged(flags), [flags]);
  const approved = useMemo(() => flags.filter((f) => f.status === "sent"), [flags]);
  const dismissed = useMemo(() => flags.filter((f) => f.status === "dismissed"), [flags]);
  const toCollect = useMemo(() => flags.filter((f) => f.signed_cents > 0 && f.status !== "dismissed"), [flags]);
  const owedOpen = useMemo(() => open.filter((f) => f.signed_cents > 0), [open]);
  const weOwe = useMemo(() => open.filter((f) => f.signed_cents < 0), [open]);
  const attention = useMemo(() => open.filter((f) => f.signed_cents === 0), [open]);

  const tracker = useMemo(() => {
    const all = kitSum(toCollect);
    const done = kitSum(toCollect.filter((f) => f.status === "sent"));
    const draftedIds = new Set(decisions.filter((d) => d.draft).map((d) => d.finding_id));
    return { all, done, pct: all ? Math.min(100, (done / all) * 100) : 0, drafted: draftedIds.size };
  }, [toCollect, decisions]);

  const pool = filter === "open" ? open : filter === "approved" ? approved : dismissed;
  const inSeam = useMemo(() => (selectedSeam && selectedSeam !== "__all" ? pool.filter((f) => f.seam === selectedSeam) : pool), [pool, selectedSeam]);
  const groups = useMemo(() => {
    const by = new Map();
    for (const f of inSeam) {
      if (!by.has(f.cause)) by.set(f.cause, []);
      by.get(f.cause).push(f);
    }
    const arr = [...by.entries()].map(([cause, rows]) => [cause, rows.sort((a, b) => Math.abs(b.signed_cents) - Math.abs(a.signed_cents))]);
    return arr.sort((a, b) => Math.abs(kitSum(b[1])) - Math.abs(kitSum(a[1])) || b[1].length - a[1].length);
  }, [inSeam]);
  const seamMax = useMemo(() => Math.max(1, ...groups.map(([, rows]) => Math.abs(kitSum(rows)))), [groups]);

  // Keep one cause open: the first one when the seam or filter changes.
  useEffect(() => {
    if (!groups.length) return;
    if (!activeCause || !groups.some(([c]) => c === activeCause)) {
      setActiveCause(groups[0][0]);
      setSelectedFlagKey(groups[0][1][0].stable_key);
    }
  }, [groups, activeCause, setSelectedFlagKey]);

  const selected = flags.find((f) => f.stable_key === selectedFlagKey) || groups[0]?.[1][0] || null;
  const causeRows = useMemo(() => (selected ? flags.filter((f) => f.cause === selected.cause).sort((a, b) => Math.abs(b.signed_cents) - Math.abs(a.signed_cents)) : []), [flags, selected]);

  // Biggest leak: the seam with the most open dollars, then its biggest cause.
  const leak = useMemo(() => {
    const bySeam = new Map();
    for (const f of owedOpen) bySeam.set(f.seam, (bySeam.get(f.seam) || 0) + f.signed_cents);
    const seam = [...bySeam.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!seam) return null;
    const byCause = new Map();
    for (const f of owedOpen.filter((x) => x.seam === seam[0])) {
      if (!byCause.has(f.cause)) byCause.set(f.cause, []);
      byCause.get(f.cause).push(f);
    }
    const [cause, rows] = [...byCause.entries()].sort((a, b) => kitSum(b[1]) - kitSum(a[1]))[0];
    return { seam: seam[0], cents: seam[1], cause, n: rows.length, causeCents: kitSum(rows) };
  }, [owedOpen]);

  const scrollToFixes = () => requestAnimationFrame(() => document.getElementById("todays-fixes")?.scrollIntoView({ behavior: "smooth", block: "start" }));

  if (!meta.loaded) return <SeamsSkeleton />;
  if (!flags.length) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="font-display text-[22px] text-[#1C1917]">No findings loaded yet.</p>
        <p className="mt-1 text-[13px] text-[#6B635A]">Load findings.csv and evidence.csv from our detection code. Decisions are kept across reloads.</p>
        <button type="button" className="btn-forest mt-4" onClick={onGoData}>Load findings</button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rise lg:col-span-4" aria-label="Morning brief">
        <p className="brief-label">Morning brief · {flags.length} findings from our code</p>
        <h1 className="brief-headline mt-3 font-display font-medium text-[#1C1917]">
          Northline leaked <span className="text-[#C2410C]">{fmt(kitSum(toCollect))}</span>{changed.hasOctober ? " since Sep 1" : " in September"}.
        </h1>
        {tracker.done ? (
          <p className="brief-progress mt-2" role="status">
            <span className="money">{fmt(kitSum(owedOpen))}</span> still open · <span className="money">{fmt(tracker.done)}</span> approved
          </p>
        ) : null}
        <p className="mt-4 text-[14px] leading-[1.7] text-[#1C1917]">
          {leak ? (
            <>
              The biggest leak is{" "}
              <button type="button" className="seam-pill" style={{ background: "#FBEDE4", color: "#9A3412" }} onClick={() => { setActiveCause(leak.cause); scrollToFixes(); }}>
                {seamLabel(leak.seam)}
              </button>{" "}
              (<span className="money font-semibold">{fmt(leak.cents)}</span>), led by {leak.cause.toLowerCase()} ({leak.n} {leak.n === 1 ? "line" : "lines"}, <span className="money font-semibold">{fmt(leak.causeCents)}</span>).
            </>
          ) : "Nothing left to collect. Every finding is decided."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {weOwe.length ? <span className="chip chip-credit">We owe customers <span className="money font-semibold">{fmt(-kitSum(weOwe))}</span></span> : null}
          {attention.length ? <span className="chip chip-overdue">{attention.length} need a reply or a hold</span> : null}
          {months.map((m) => (
            <span key={m.month} className="chip chip-neutral">{KIT_MONTH_LABEL[m.month] || m.month} · {m.rows} rows · <span className="money">{fmt(m.cents)}</span></span>
          ))}
        </div>
        {changed.hasOctober ? (
          <div className="kit-changed mt-3" aria-label="What changed after October">
            <span><b style={{ color: KC.owed }}>{changed.new.length}</b> new causes</span>
            <span><b>{changed.open.length}</b> still open</span>
            <span><b style={{ color: KC.teal }}>{changed.fixed.length}</b> fixed</span>
          </div>
        ) : null}

        <article className="card card-lift mt-4 px-4 py-3.5" aria-label="Fix tracker">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-medium text-[#1C1917]">Fixes approved</p>
            <p className="money text-[13px] font-semibold text-[#1C1917]">
              {fmt(tracker.done)}
              <span className="ml-2 text-[11px] font-normal text-[#6B635A]">of {fmt(tracker.all)}</span>
            </p>
          </div>
          <div className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-[#F1ECE4]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tracker.pct)} aria-label="Share of money to collect that Dana approved">
            <div className="progress-fill h-full rounded-full bg-[#1F4D3A]" style={{ width: `${tracker.pct}%` }} />
          </div>
          <p className="mt-2.5 flex flex-wrap gap-x-3 text-[11px] text-[#6B635A]">
            <span>Found {flags.length}</span><span aria-hidden>·</span>
            <span>Drafted {tracker.drafted}</span><span aria-hidden>·</span>
            <span>Approved {approved.length}</span><span aria-hidden>·</span>
            <span>Dismissed {dismissed.length}</span>
          </p>
        </article>
      </section>

      <WhereItSlipped flags={open} ruledCount={dismissed.length} stages={{ contracted: true, shipped: true, invoiced: true, collected: false }} onPicked={scrollToFixes} />

      <section className="rise lg:col-span-6 scroll-mt-24" aria-label="Today's fixes">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="todays-fixes" className="fixes-heading font-display text-[22px] font-semibold leading-tight text-[#1C1917]">
              Today's fixes{selectedSeam && selectedSeam !== "__all" ? ` · ${seamLabel(selectedSeam)}` : ""}
            </h2>
            <p className="mt-1 text-[12.5px] text-[#6B635A]">{groups.length} {groups.length === 1 ? "cause" : "causes"} · {inSeam.length} lines · biggest dollars first</p>
          </div>
          <div className="segmented" role="group" aria-label="Status">
            {[["open", `New ${open.length}`], ["approved", `Approved ${approved.length}`], ["dismissed", `Dismissed ${dismissed.length}`]].map(([id, label]) => (
              <button key={id} type="button" className="segmented-option" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        {groups.length ? (
          <ul className="mt-4 grid gap-2.5" aria-label="Causes">
            {(allCauses ? groups : groups.slice(0, 8)).map(([cause, rows]) => (
              <KitCauseTile
                key={cause}
                cause={cause}
                rows={rows}
                seamMax={seamMax}
                active={cause === activeCause}
                selectedKey={selected?.stable_key}
                onPick={(c, rs) => { setActiveCause(c === activeCause ? null : c); setSelectedFlagKey(rs[0].stable_key); }}
                onSelect={(f) => setSelectedFlagKey(f.stable_key)}
                onDraft={(rs) => setDrafting(rs)}
              />
            ))}
          </ul>
        ) : null}
        {groups.length > 8 ? (
          <button type="button" className="fix-quiet mt-3" onClick={() => setAllCauses((v) => !v)}>
            {allCauses ? "Show the top 8 causes" : `Show all ${groups.length} causes`}
          </button>
        ) : null}
        {groups.length ? null : (
          <p className="card mt-4 px-4 py-6 text-center text-[14px] text-[#6B635A]">Nothing {filter === "open" ? "open" : filter} on this seam.</p>
        )}
      </section>

      <KitProof flag={selected} causeRows={causeRows} onDraft={(rs) => setDrafting(rs)} />

      {drafting ? <FixDrawer rows={drafting} role={role} onClose={() => setDrafting(null)} /> : null}
    </div>
  );
}
