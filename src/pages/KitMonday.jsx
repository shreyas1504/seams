// Dana's Monday note for Frank: got back last week, still at risk, what he needs to decide. Editable, copyable.
import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/engine/engine.js";
import { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import { useKitFlags } from "@/lib/kitData.js";
import { kitMondayNote } from "@/lib/kitIssues.js";

function MonTile({ label, value, sub, tone }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B635A]">{label}</p>
      <p className="money mt-1 font-display text-[26px] font-semibold" style={{ color: tone }}>{value}</p>
      <p className="mt-0.5 text-[12px] text-[#6B635A]">{sub}</p>
    </div>
  );
}

export default function KitMonday({ onOpenIssue }) {
  const [flags, , meta] = useKitFlags();
  const note = useMemo(() => kitMondayNote(flags), [flags]);
  const [text, setText] = useState(note.text);
  const [copied, setCopied] = useState(false);
  useEffect(() => setText(note.text), [note.text]);
  if (!meta.loaded) return <SeamsSkeleton />;
  if (!flags.length) return <p className="card p-6 text-[#6B635A]">Load findings.csv and evidence.csv first.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rise lg:col-span-12">
        <p className="brief-label">Monday 8:00 · for Frank · {note.weekLabel}</p>
        <h1 className="mt-2 font-display text-[28px] font-medium text-[#1C1917]">Monday note</h1>
        <p className="mt-1 text-[13px] text-[#6B635A]">Three answers Frank asks for every week, written from the findings file and your decisions. Edit it, then copy it into your email.</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-3 lg:col-span-12">
        <MonTile label="Got back last week" value={fmt(note.back.cents)} sub={note.back.n ? `${note.back.n} lines approved to collect${note.back.credits ? ` · ${fmt(note.back.credits)} credited` : ""}` : "Approve fixes in Today to fill this"} tone="#1F4D3A" />
        <MonTile label="Still at risk" value={fmt(note.risk.total)} sub={`${fmt(note.risk.collect)} to collect${note.risk.payments ? ` · ${fmt(note.risk.payments)} payments on hold` : ""} · we owe ${fmt(note.risk.credits)}`} tone="#C2410C" />
        <MonTile label="Needs Frank" value={String(note.decide.length)} sub={note.decide.length ? "decisions below" : "nothing to decide"} tone="#1C1917" />
      </div>
      <section className="card p-5 lg:col-span-5" aria-label="What Frank needs to decide">
        <p className="iss-box__title">What Frank needs to decide</p>
        <ol className="mt-3 grid gap-2.5">
          {note.decide.map((d, i) => (
            <li key={i} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-[#1C1917]">
              <span className="iss-avatar" aria-hidden>{String.fromCharCode(97 + i)}</span>
              <span className="min-w-0 flex-1">{d.text}{" "}
                {onOpenIssue ? <button type="button" className="iss-cite" onClick={() => onOpenIssue(d.ref.split(",")[0].trim())}>{d.ref}</button> : <span className="iss-cite">{d.ref}</span>}
              </span>
            </li>
          ))}
          {!note.decide.length ? <li className="text-[13px] text-[#6B635A]">Nothing needs Frank this week.</li> : null}
        </ol>
      </section>
      <section className="card p-5 lg:col-span-7" aria-label="Note to Frank">
        <div className="flex items-center justify-between gap-2">
          <p className="iss-box__title">Note to Frank · edit freely</p>
          <div className="flex items-center gap-2">
            <button type="button" className="fix-quiet" onClick={() => setText(note.text)}>Reset</button>
            <button type="button" className="fix-pill" onClick={copy}>{copied ? "Copied" : "Copy note"}</button>
          </div>
        </div>
        <textarea className="mt-3 h-[340px] w-full resize-y rounded-[12px] border border-[#ECE4D8] bg-[#FCFAF7] p-3.5 text-[13.5px] leading-relaxed text-[#1C1917]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Monday note text" />
        <p className="mt-2 text-[11.5px] text-[#6B635A]">Amounts come from findings.csv; "got back" counts what you approved in the last 7 days. Nothing is sent from the app.</p>
      </section>
    </div>
  );
}
