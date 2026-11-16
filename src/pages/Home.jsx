// Starter Home: hero, scorecard, line status board, ranked customers/vendors, patterns, ruled-out list.
// M4–M8 in PLAN.md extend this (settlement bar, lookup, stepper, letters, Ask Seams, twist card).
import React, { useMemo, useState } from "react";
import { useEntity } from "@/lib/useEntity";
import { rankParties, fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

const LIVE = new Set(["open", "sent", "disputed"]);
const BOARD = [
  { seam: "CRM→Billing", label: "Contract → Billing" },
  { seam: "Warehouse→Billing", label: "Warehouse → Billing" },
  { seam: "Billing→Cash", label: "Billing → Cash", amber: true },
  { seam: "AP→Vendors", label: "AP → Vendors" },
  { seam: "Returns→Billing", label: "Returns → Billing" },
];

export default function Home() {
  const [flags] = useEntity("Flag");
  const [ruled] = useEntity("RuledOut");
  const [patterns] = useEntity("Pattern");
  const [open, setOpen] = useState(null);
  const live = useMemo(() => flags.filter((f) => LIVE.has(f.status)), [flags]);
  const sum = (b) => live.filter((f) => f.bucket === b).reduce((a, f) => a + f.amount_cents, 0);
  const { customers, vendors } = useMemo(() => rankParties(live), [live]);
  const bySeam = (s) => live.filter((f) => f.seam === s);
  const maxRow = Math.max(1, ...BOARD.map((r) => bySeam(r.seam).reduce((a, f) => a + f.amount_cents, 0)));

  if (!flags.length) return <p className="text-[#5B5F68]">No data yet. Go to Data → Reset demo.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <section className="md:col-span-5 md:sticky md:top-4 md:self-start">
        <header className="mb-3"><span className="font-semibold">Seams</span> <span className="text-[#5B5F68]">· Mind the gap</span></header>
        <div className="rounded-xl border border-[#E2DDD2] bg-white p-4">
          <div className="font-mono text-4xl font-semibold text-[#C22A25]">{fmt(sum("recoverable"))}</div>
          <div className="text-sm">owed to Northline · {customers.length} customers to square up · {vendors.length} vendors to recover</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#FBEFD6] px-3 py-1 font-mono text-[#8A5A00]">{fmt(sum("overdue"))} overdue to chase</span>
            <span className="rounded-full bg-[#E6F4EC] px-3 py-1 font-mono text-[#17734B]">{fmt(sum("credit_owed"))} we owe customers</span>
          </div>
          <div className="mt-3 border-t border-[#E2DDD2] pt-2 font-mono text-xs text-[#5B5F68]">
            {live.filter((f) => f.bucket === "recoverable").length} flagged · {ruled.length} look-alikes ruled out · {flags.filter((f) => f.status === "dismissed").length} overturned
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-[#E2DDD2] bg-white p-4 text-sm">
          {BOARD.map((r) => {
            const fs = bySeam(r.seam), c = fs.reduce((a, f) => a + f.amount_cents, 0);
            if (!fs.length) return null;
            return (
              <div key={r.seam} className="mb-2">
                <div className="flex justify-between"><span>{r.label} <span className="text-xs text-[#5B5F68]">{r.amber ? "Cash to chase" : "Leaking"}</span></span><span className="font-mono">{fmt(c)} · {fs.length}</span></div>
                <div className="h-2 rounded bg-[#F6F3EC]"><div className={`h-2 rounded ${r.amber ? "bg-[#8A5A00]" : "bg-[#C22A25]"}`} style={{ width: `${(c / maxRow) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="md:col-span-7">
        <h2 className="mb-2 text-sm font-semibold">Customers to square up</h2>
        {customers.map((p) => (
          <div key={p.party} className="mb-2 rounded-xl border border-[#E2DDD2] bg-white p-3">
            <div className="flex items-center justify-between">
              <div><div className="font-medium">{p.party}</div>
                <div className="text-xs text-[#5B5F68]">{p.flags.filter((f) => f.bucket === "recoverable").length} to bill · {p.we_owe ? `we owe ${fmt(p.we_owe)}` : "no credits"}{p.overdue ? ` · overdue ${fmt(p.overdue)}` : ""}</div></div>
              <span className={`font-mono ${p.net < 0 ? "text-[#17734B]" : "text-[#C22A25]"}`}>{p.net < 0 ? "−" + fmt(-p.net) : fmt(p.net || p.overdue)}</span>
            </div>
            {p.flags.map((f) => (
              <div key={f.stable_key}>
                <button onClick={() => setOpen(open === f.stable_key ? null : f.stable_key)} className="mt-1 flex w-full justify-between text-left text-xs">
                  <span>{f.rule}</span><span className="font-mono">{fmt(f.amount_cents)}</span>
                </button>
                {open === f.stable_key && <SideBySide flag={f} />}
              </div>
            ))}
          </div>
        ))}
        <h2 className="mb-2 mt-4 text-sm font-semibold">Vendors to recover</h2>
        {vendors.map((p) => (
          <div key={p.party} className="mb-2 rounded-xl border border-[#E2DDD2] bg-white p-3">
            <div className="flex justify-between"><span className="font-medium">{p.party}</span><span className="font-mono text-[#C22A25]">{fmt(p.net)}</span></div>
            {p.flags.map((f) => <div key={f.stable_key}><button onClick={() => setOpen(open === f.stable_key ? null : f.stable_key)} className="mt-1 text-xs">{f.rule}</button>{open === f.stable_key && <SideBySide flag={f} />}</div>)}
          </div>
        ))}
        <h2 className="mb-2 mt-4 text-sm font-semibold">Patterns</h2>
        {[...patterns].sort((a, b) => b.amount_cents - a.amount_cents).map((p) => (
          <div key={p.key} className="mb-2 rounded-xl border border-[#E2DDD2] bg-white p-3 text-sm">
            <div className="flex justify-between"><span>{p.title}</span><span className="font-mono">{fmt(p.amount_cents)}</span></div>
            <div className="text-xs text-[#5B5F68]">{p.detail} · suggested fix: {p.fix}</div>
          </div>
        ))}
        <details className="mt-4 rounded-xl border border-[#E2DDD2] bg-white p-3 text-sm">
          <summary>Look-alikes ruled out ({ruled.length})</summary>
          {ruled.map((r, i) => <div key={i} className="mt-1 text-xs"><span className="text-[#5B5F68]">{r.rule}:</span> {r.reason}</div>)}
        </details>
      </section>
    </div>
  );
}
