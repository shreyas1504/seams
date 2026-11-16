// Today, kit mode: Dana's queue from findings.csv / evidence.csv, grouped by cause, biggest dollars first.
// Every dollar shown is summed from findings.csv rows, so the app's totals match the submitted file.
import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { seamLabel } from "@/components/systems.js";
import WhereItSlipped from "@/components/WhereItSlipped.jsx";
import { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import FixDrawer from "@/components/FixDrawer.jsx";
import { useKitFlags, kitMonthTotals, kitWhatChanged } from "@/lib/kitData.js";
import { displayText } from "@/lib/displayText.js";
import { openSeamsLookup } from "@/actions/dataChanged.js";

const KIT_MONTH_LABEL = { september: "September", october: "October" };
const kitSum = (fs) => fs.reduce((a, f) => a + f.signed_cents, 0);

function KitCauseGroup({ cause, rows, selectedKey, onSelect, onDraft }) {
  const [open, setOpen] = useState(false);
  const total = kitSum(rows);
  const shown = open ? rows : rows.slice(0, 3);
  const first = rows[0];
  return (
    <article className="cause-group card" aria-label={`${cause}: ${rows.length} rows`}>
      <header className="cause-head">
        <div className="min-w-0">
          <p className="cause-title">{cause}</p>
          <p className="cause-meta">
            {first.rule} · {rows.length} {rows.length === 1 ? "line" : "lines"}
            {rows.some((r) => r.month === "october") && rows.some((r) => r.month === "september") ? " · Sep + Oct" : rows.some((r) => r.month === "october") ? " · new in October" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`money text-[14px] font-semibold ${total < 0 ? "text-[#0F766E]" : total === 0 ? "text-[#57534E]" : "text-[#C2410C]"}`}>
            {total === 0 ? "No $ · needs action" : total < 0 ? `${fmt(-total)} we owe` : fmt(total)}
          </span>
          <button type="button" className="fix-pill" onClick={() => onDraft(rows)}>
            Draft fix{rows.length > 1 ? ` · ${rows.length}` : ""}
          </button>
        </div>
      </header>
      <ul className="cause-rows">
        {shown.map((f) => (
          <li key={f.stable_key}>
            <button type="button" className="cause-row" aria-pressed={selectedKey === f.stable_key} onClick={() => onSelect(f)}>
              <span className="cause-row-ids">{f.ids.join(" · ")}</span>
              <span className="cause-row-party">{f.party}</span>
              <span className={`money cause-row-amt ${f.signed_cents < 0 ? "text-[#0F766E]" : ""}`}>{f.signed_cents === 0 ? "$0.00" : fmt(f.signed_cents)}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > 3 ? (
        <button type="button" className="fix-quiet mt-1" onClick={() => setOpen((v) => !v)}>
          {open ? "Show fewer" : `Show all ${rows.length} lines`}
        </button>
      ) : null}
    </article>
  );
}

function KitProof({ flag }) {
  if (!flag) return <section className="card p-5 lg:col-span-5" aria-label="Proof"><p className="text-[#6B635A]">Pick a line to see its records.</p></section>;
  return (
    <section className="card rise p-5 lg:col-span-5" aria-label="Proof trace">
      <div className="flex items-center justify-between gap-3">
        <p className="brief-label">Proof · from evidence.csv</p>
        <span className={`fix-stamp ${flag.status === "sent" ? "fix-stamp-sent" : ""}`}>{flag.status === "sent" ? "APPROVED" : flag.status === "dismissed" ? "DISMISSED" : "OPEN"}</span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-[19px] text-[#1C1917]">{flag.title}</h3>
        <span className={`money text-[18px] font-semibold ${flag.signed_cents < 0 ? "text-[#0F766E]" : "text-[#1C1917]"}`}>{fmt(flag.signed_cents)}</span>
      </div>
      <p className="mt-1 text-[13px] text-[#44403C]">{displayText(flag.why)}</p>
      <p className="mt-1 text-[12px] text-[#6B635A]">Cause: {flag.cause}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(flag.idFields).map(([k, v]) => (
          <button key={k} type="button" className="record-chip" onClick={() => openSeamsLookup(v)}>
            {k.replace("_", " ")} {v}
          </button>
        ))}
      </div>
      <ol className="evidence-list mt-4">
        {flag.evidence.map((e, i) => (
          <li key={i} className="evidence-row">
            <p className="evidence-src">
              <span className="evidence-file">{e.file}</span> · {e.id}
            </p>
            <p className="evidence-shows">{displayText(e.fields.shows)}</p>
            {e.fields.expected ? <p className="evidence-expected">Rule says: {displayText(e.fields.expected)}</p> : null}
          </li>
        ))}
      </ol>
      {flag.decision ? (
        <p className="mt-3 text-[12px] text-[#6B635A]">
          {flag.decision.status === "approved" ? "Approved" : "Dismissed"} by {flag.decision.decided_by} · {String(flag.decision.decided_at || "").slice(0, 16).replace("T", " ")}
          {flag.decision.reason ? ` · ${flag.decision.reason}` : ""}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip chip-neutral">Amount computed by our code, not AI</span>
        <span className="chip chip-neutral">Same row as findings.csv</span>
      </div>
    </section>
  );
}

export default function KitToday({ role, onGoData }) {
  const [flags, , meta, { decisions }] = useKitFlags();
  const { selectedSeam, setSelectedSeam, selectedFlagKey, setSelectedFlagKey } = useSelectedSeam();
  const [drafting, setDrafting] = useState(null);
  const [filter, setFilter] = useState("open");
  const [allCauses, setAllCauses] = useState(false);

  const open = useMemo(() => flags.filter((f) => f.status === "open"), [flags]);
  const months = useMemo(() => kitMonthTotals(flags), [flags]);
  const changed = useMemo(() => kitWhatChanged(flags), [flags]);
  const owed = useMemo(() => open.filter((f) => f.signed_cents > 0), [open]);
  const weOwe = useMemo(() => open.filter((f) => f.signed_cents < 0), [open]);
  const attention = useMemo(() => open.filter((f) => f.signed_cents === 0), [open]);
  const approved = useMemo(() => flags.filter((f) => f.status === "sent"), [flags]);

  const pool = filter === "open" ? open : filter === "approved" ? approved : flags.filter((f) => f.status === "dismissed");
  const inSeam = selectedSeam === "__all" || !selectedSeam ? pool : pool.filter((f) => f.seam === selectedSeam);
  const groups = useMemo(() => {
    const by = new Map();
    for (const f of inSeam) {
      if (!by.has(f.cause)) by.set(f.cause, []);
      by.get(f.cause).push(f);
    }
    const arr = [...by.entries()].map(([cause, rows]) => [cause, rows.sort((a, b) => Math.abs(b.signed_cents) - Math.abs(a.signed_cents))]);
    return arr.sort((a, b) => Math.abs(kitSum(b[1])) - Math.abs(kitSum(a[1])) || b[1].length - a[1].length);
  }, [inSeam]);
  const selected = flags.find((f) => f.stable_key === selectedFlagKey) || groups[0]?.[1][0] || null;
  useEffect(() => {
    if (!selectedFlagKey && groups[0]) setSelectedFlagKey(groups[0][1][0].stable_key);
  }, [groups, selectedFlagKey, setSelectedFlagKey]);

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
  const lead = groups[0];
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rise lg:col-span-4" aria-label="Morning brief">
        <p className="brief-label">Morning brief · from findings.csv · {flags.length} rows</p>
        <h1 className="brief-headline mt-3 font-display font-medium text-[#1C1917]">
          <span className="text-[#C2410C]">{fmt(kitSum(owed))}</span> to recover today.
        </h1>
        <p className="mt-3 text-[14px] leading-[1.7] text-[#1C1917]">
          {lead ? (
            <>
              Biggest open cause: <strong>{lead[0]}</strong> ({lead[1].length} {lead[1].length === 1 ? "line" : "lines"}, <span className="money font-semibold">{fmt(kitSum(lead[1]))}</span>).
            </>
          ) : (
            "Everything is decided."
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {weOwe.length ? <span className="chip chip-credit">We owe customers <span className="money font-semibold">{fmt(-kitSum(weOwe))}</span></span> : null}
          {attention.length ? <span className="chip chip-overdue">{attention.length} need a reply or a hold</span> : null}
          <span className="chip chip-neutral">{decisions.length} decisions kept</span>
        </div>

        <article className="card card-lift mt-4 px-4 py-3.5" aria-label="Totals by month">
          <p className="text-[12px] font-medium text-[#1C1917]">Totals by month · match findings.csv</p>
          {months.map((m) => (
            <div key={m.month} className="mt-1.5 flex items-baseline justify-between text-[13px]">
              <span>{KIT_MONTH_LABEL[m.month] || m.month} · {m.rows} rows</span>
              <span className="money font-semibold">{fmt(m.cents)}</span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-[#6B635A]">Net of credits we owe. Approved {approved.length} · open {open.length}.</p>
        </article>

        <article className="card card-lift mt-4 px-4 py-3.5" aria-label="What changed">
          <p className="text-[12px] font-medium text-[#1C1917]">What changed{changed.hasOctober ? " in October" : ""}</p>
          {changed.hasOctober ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><p className="font-display text-[22px] text-[#C2410C]">{changed.new.length}</p><p className="text-[11px] text-[#6B635A]">new causes</p></div>
              <div><p className="font-display text-[22px] text-[#1C1917]">{changed.open.length}</p><p className="text-[11px] text-[#6B635A]">still open</p></div>
              <div><p className="font-display text-[22px] text-[#0F766E]">{changed.fixed.length}</p><p className="text-[11px] text-[#6B635A]">fixed</p></div>
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-[#6B635A]">September is the baseline. When October loads, causes split into new, still open and fixed, and your decisions carry over by finding_id.</p>
          )}
          {changed.hasOctober && changed.new.length ? <p className="mt-2 text-[11.5px] text-[#44403C]">New: {changed.new.slice(0, 3).join("; ")}{changed.new.length > 3 ? "…" : ""}</p> : null}
        </article>
      </section>

      <WhereItSlipped flags={flags} ruledCount={0} stages={{}} />

      <section className="lg:col-span-7" aria-label="Today's queue">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="todays-fixes" className="fixes-heading font-display text-[22px] text-[#1C1917]">
              Today's queue{selectedSeam && selectedSeam !== "__all" ? ` · ${seamLabel(selectedSeam)}` : ""}
            </h2>
            <p className="text-[12.5px] text-[#6B635A]">Grouped by cause, biggest dollars first. {groups.length} causes, {inSeam.length} lines.</p>
          </div>
          <div className="segmented" role="group" aria-label="Status">
            {[["open", `Open ${open.length}`], ["approved", `Approved ${approved.length}`], ["dismissed", "Dismissed"]].map(([id, label]) => (
              <button key={id} type="button" className="segmented-option" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="ask-chip" aria-pressed={!selectedSeam || selectedSeam === "__all"} onClick={() => setSelectedSeam("__all")}>All seams</button>
          {[...new Set(pool.map((f) => f.seam))].map((s) => (
            <button key={s} type="button" className="ask-chip" aria-pressed={selectedSeam === s} onClick={() => setSelectedSeam(s)}>{seamLabel(s)}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-3">
          {(allCauses ? groups : groups.slice(0, 8)).map(([cause, rows]) => (
            <KitCauseGroup key={cause} cause={cause} rows={rows} selectedKey={selected?.stable_key} onSelect={(f) => setSelectedFlagKey(f.stable_key)} onDraft={(rs) => setDrafting(rs)} />
          ))}
          {!groups.length ? <p className="card p-5 text-[#6B635A]">Nothing here.</p> : null}
          {groups.length > 8 ? (
            <button type="button" className="fix-quiet" onClick={() => setAllCauses((v) => !v)}>
              {allCauses ? "Show the top 8 causes" : `Show all ${groups.length} causes`}
            </button>
          ) : null}
        </div>
      </section>

      <KitProof flag={selected} />

      {drafting ? <FixDrawer rows={drafting} role={role} onClose={() => setDrafting(null)} /> : null}
    </div>
  );
}
