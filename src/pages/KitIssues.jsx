// Issues: a Linear-style view of every cause. List on the left, the open issue on the right:
// what happened (template, or AI checked against the records), fix the source, timeline, line checklist.
import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { seamLabel } from "@/components/systems.js";
import { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import FixDrawer from "@/components/FixDrawer.jsx";
import { useKitFlags } from "@/lib/kitData.js";
import { kitIssues, issTimeline, issSourceFix, issEvidenceRows, issFallbackNarrative, issCheckNarrative, issShortDate } from "@/lib/kitIssues.js";
import { displayText } from "@/lib/displayText.js";
import { openSeamsLookup } from "@/actions/dataChanged.js";

const ISS_STATUS_TONE = { New: "#C2410C", "In progress": "#B45309", Done: "#1F4D3A", Dismissed: "#78716C" };
const issMoney = (c) => (c < 0 ? `${fmt(-c)} we owe` : c === 0 ? "$0" : fmt(c));

function IssPriority({ p }) {
  if (p.level === 4) return <span className="iss-prio is-urgent" title="Urgent" aria-label="Urgent priority">!</span>;
  return (
    <span className="iss-prio" title={p.label} aria-label={`${p.label} priority`}>
      {[1, 2, 3].map((i) => <i key={i} style={{ height: 4 + i * 3, opacity: i <= p.level ? 1 : 0.22 }} />)}
    </span>
  );
}

function IssStatus({ status, counts, total }) {
  const pct = total ? Math.round(((counts.sent + counts.dismissed) / total) * 100) : 0;
  const tone = ISS_STATUS_TONE[status] || "#78716C";
  return (
    <span className="iss-status" title={`${status} · ${pct}% decided`} aria-label={`${status}, ${pct}% decided`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={tone} strokeWidth="1.6" strokeDasharray={status === "New" ? "2 2" : undefined} />
        {pct ? <path d={`M7 7 L7 1.5 A5.5 5.5 0 ${pct > 50 ? 1 : 0} 1 ${7 + 5.5 * Math.sin((pct / 100) * 2 * Math.PI)} ${7 - 5.5 * Math.cos((pct / 100) * 2 * Math.PI)} Z`} fill={tone} /> : null}
      </svg>
    </span>
  );
}

function IssAvatar({ name }) {
  const initials = name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return <span className="iss-avatar" aria-hidden>{initials}</span>;
}

function IssNarrative({ issue }) {
  const [state, setState] = useState({ busy: false, narr: null, note: "" });
  useEffect(() => setState({ busy: false, narr: null, note: "" }), [issue.key]);
  const fallback = useMemo(() => issFallbackNarrative(issue), [issue]);
  const narr = state.narr || fallback;
  const explain = globalThis.__seamsExplainIssue;
  const run = async () => {
    const rows = issEvidenceRows(issue);
    setState((s) => ({ ...s, busy: true, note: "" }));
    try {
      const raw = await explain({ title: issue.cause, rows });
      const ok = issCheckNarrative(raw, issue, rows);
      setState({ busy: false, narr: ok, note: ok ? "" : "The AI answer cited a number or record that is not in the evidence, so the template is shown instead." });
    } catch (e) {
      setState({ busy: false, narr: null, note: `AI unavailable (${e?.message || "error"}); showing the template.` });
    }
  };
  return (
    <section className="iss-box" aria-label="What happened">
      <div className="flex items-center justify-between gap-2">
        <p className="iss-box__title">What happened</p>
        <span className="iss-tag">{narr.source === "ai" ? "AI explanation · every sentence cites a record" : "From the records · no AI"}</span>
      </div>
      <ul className="mt-2 grid gap-2">
        {narr.sentences.map((s, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-[#1C1917]">
            {displayText(s.text)}{" "}
            {s.cites.map((c) => <span key={c} className="iss-cite">{c}</span>)}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {explain ? (
          <button type="button" className="fix-quiet" disabled={state.busy} onClick={run}>{state.busy ? "Reading the records…" : narr.source === "ai" ? "Explain again" : "Explain with AI"}</button>
        ) : (
          <span className="text-[11.5px] text-[#6B635A]">AI explanation runs in the Base44 app.</span>
        )}
        {state.note ? <span className="text-[11.5px] text-[#9F1239]">{state.note}</span> : null}
      </div>
    </section>
  );
}

function IssDetail({ issue, onDraft }) {
  const timeline = useMemo(() => issTimeline(issue), [issue]);
  const total = issue.rows.length;
  const decided = issue.counts.sent + issue.counts.dismissed;
  return (
    <section className="card rise self-start p-5 lg:sticky lg:top-20 lg:col-span-7" aria-label={`Issue ${issue.ref}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B635A]">
        <span className="iss-ref">{issue.ref}</span>
        <span aria-hidden>·</span>
        <span>{seamLabel(issue.seam)}</span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-[21px] font-semibold leading-snug text-[#1C1917]">{issue.cause}</h2>
        <span className="money shrink-0 text-[18px] font-semibold" style={{ color: issue.cents < 0 ? "#0F766E" : "#C2410C" }}>{issMoney(issue.cents)}</span>
      </div>

      <dl className="iss-props mt-4">
        <div><dt>Status</dt><dd><IssStatus status={issue.status} counts={issue.counts} total={total} /> {issue.status} · {decided}/{total} decided</dd></div>
        <div><dt>Priority</dt><dd><IssPriority p={issue.priority} /> {issue.priority.label}</dd></div>
        <div><dt>Assignee</dt><dd><IssAvatar name={issue.assignee.name} /> {issue.assignee.name} · {issue.assignee.role}{issue.assignee.escalate ? <span className="iss-esc">+ {issue.assignee.escalate}</span> : null}</dd></div>
        <div><dt>Labels</dt><dd className="flex flex-wrap gap-1">{issue.labels.map((l) => <span key={l} className={`iss-label${l === "Reopened" ? " is-hot" : ""}`}>{l}</span>)}</dd></div>
        <div><dt>Seen</dt><dd>{issue.firstDate ? (issue.firstDate === issue.lastDate ? issShortDate(issue.firstDate) : `${issShortDate(issue.firstDate)} → ${issShortDate(issue.lastDate)}`) : "—"}</dd></div>
      </dl>

      <div className="mt-4 grid gap-3">
        <IssNarrative issue={issue} />
        <section className="iss-box" aria-label="Fix the source">
          <p className="iss-box__title">Fix the source</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#1C1917]">{issSourceFix(issue.rule)}</p>
          <p className="mt-1 text-[11.5px] text-[#6B635A]">Owner: {issue.assignee.name}. The fix below clears today's lines; this stops new ones.</p>
        </section>

        <section className="iss-box" aria-label="Timeline">
          <p className="iss-box__title">Timeline</p>
          <ol className="iss-timeline mt-2">
            {timeline.map((e) => (
              <li key={e.key} className={`is-${e.kind}`}>
                <span className="iss-timeline__date">{e.date ? issShortDate(e.date) : ""}</span>
                <span className="iss-timeline__dot" aria-hidden />
                <span className="iss-timeline__text">{e.text}</span>
                {e.kind === "line" ? <span className="money iss-timeline__amt" style={{ color: e.cents < 0 ? "#0F766E" : "#44403C" }}>{issMoney(e.cents)}</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="iss-box" aria-label="Lines">
          <div className="flex items-center justify-between">
            <p className="iss-box__title">Lines · {total}</p>
            <span className="text-[11.5px] text-[#6B635A]">{decided} of {total} decided</span>
          </div>
          <ul className="mt-2 grid gap-1">
            {issue.rows.slice(0, 20).map((r) => (
              <li key={r.stable_key} className="iss-line">
                <span className={`iss-check is-${r.status}`} aria-label={r.status === "sent" ? "Approved" : r.status === "dismissed" ? "Dismissed" : "Open"}>{r.status === "sent" ? "✓" : r.status === "dismissed" ? "–" : ""}</span>
                <button type="button" className="iss-line__ids" onClick={() => openSeamsLookup(r.ids[0])}>{r.ids.join(" · ")}</button>
                <span className="iss-line__party">{r.party}</span>
                <span className="money iss-line__amt" style={{ color: r.signed_cents < 0 ? "#0F766E" : "#1C1917" }}>{issMoney(r.signed_cents)}</span>
              </li>
            ))}
          </ul>
          {total > 20 ? <p className="mt-1 text-[11.5px] text-[#6B635A]">+{total - 20} more lines in the draft</p> : null}
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {issue.counts.open ? <button type="button" className="fix-pill" onClick={() => onDraft(issue.rows.filter((r) => r.status === "open"))}>Draft fix · {issue.counts.open} open</button> : <span className="chip chip-neutral">Every line decided</span>}
        <span className="chip chip-neutral">Amounts from findings.csv, not AI</span>
      </div>
    </section>
  );
}

let issPendingCause = null;
/** Ask the Issues tab to open a cause (Today's tiles call this before switching tabs). */
export function issOpenCause(cause) { issPendingCause = cause; }

export default function KitIssues({ role }) {
  const [flags, , meta] = useKitFlags();
  const issues = useMemo(() => kitIssues(flags), [flags]);
  const [filter, setFilter] = useState("active");
  const [selected, setSelected] = useState(() => issPendingCause);
  const [drafting, setDrafting] = useState(null);
  useEffect(() => { issPendingCause = null; }, []);
  const shown = useMemo(() => issues.filter((i) => (filter === "all" ? true : filter === "active" ? i.status === "New" || i.status === "In progress" : i.status === "Done" || i.status === "Dismissed")), [issues, filter]);
  const current = issues.find((i) => i.key === selected) || shown[0] || null;

  if (!meta.loaded) return <SeamsSkeleton />;
  if (!issues.length) return <p className="card p-6 text-[#6B635A]">No findings loaded yet. Load findings.csv and evidence.csv first.</p>;
  const groups = [4, 3, 2, 1].map((lv) => [lv, shown.filter((i) => i.priority.level === lv)]).filter(([, g]) => g.length);
  const LV = { 4: "Urgent", 3: "High", 2: "Medium", 1: "Low" };
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rise lg:col-span-5" aria-label="Issues">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-[24px] font-semibold text-[#1C1917]">Issues</h1>
            <p className="text-[12.5px] text-[#6B635A]">One issue per cause · priority by dollars and risk · owner by seam</p>
          </div>
          <div className="segmented" role="group" aria-label="Issue status">
            {[["active", `Active ${issues.filter((i) => i.status === "New" || i.status === "In progress").length}`], ["done", "Done"], ["all", `All ${issues.length}`]].map(([id, label]) => (
              <button key={id} type="button" className="segmented-option" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4">
          {groups.map(([lv, g]) => (
            <div key={lv}>
              <p className="iss-group">{LV[lv]} <span>{g.length}</span></p>
              <ul className="iss-list">
                {g.map((i) => (
                  <li key={i.key}>
                    <button type="button" className="iss-row" aria-pressed={current?.key === i.key} onClick={() => setSelected(i.key)}>
                      <IssPriority p={i.priority} />
                      <span className="iss-ref">{i.ref}</span>
                      <IssStatus status={i.status} counts={i.counts} total={i.rows.length} />
                      <span className="iss-row__title">{i.cause}</span>
                      <span className="iss-row__meta">{i.rows.length}</span>
                      <span className="money iss-row__amt" style={{ color: i.cents < 0 ? "#0F766E" : "#1C1917" }}>{issMoney(i.cents)}</span>
                      <IssAvatar name={i.assignee.name} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!groups.length ? <p className="card p-5 text-[13px] text-[#6B635A]">Nothing here.</p> : null}
        </div>
      </section>
      {current ? <IssDetail issue={current} onDraft={(rs) => setDrafting(rs)} /> : null}
      {drafting ? <FixDrawer rows={drafting} role={role} onClose={() => setDrafting(null)} /> : null}
    </div>
  );
}
