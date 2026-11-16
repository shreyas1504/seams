// H3 — settlement bar by dollars: Open · Sent · Recovered · Cleared by data.
import React from "react";
import { fmt, settlementBuckets } from "@/lib/engine/engine.js";

export default function SettlementBar({ flags }) {
  const b = settlementBuckets(flags);
  const total = b.open.cents + b.sent.cents + b.recovered.cents + b.cleared.cents || 1;
  const pct = (c) => Math.max(c ? 2 : 0, Math.round((c / total) * 100));
  return (
    <div className="rounded-[24px] border border-[#E2DDD2] bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
      <div className="flex h-[6px] overflow-hidden rounded-full bg-[#EFEFEF]">
        <div className="bg-[#C22A25]" style={{ width: `${pct(b.open.cents)}%` }} title={`Open ${fmt(b.open.cents)}`} />
        <div className="border border-[#C22A25] bg-transparent" style={{ width: `${pct(b.sent.cents)}%` }} title={`Sent ${fmt(b.sent.cents)}`} />
        <div className="bg-[#17734B]" style={{ width: `${pct(b.recovered.cents)}%` }} title={`Recovered ${fmt(b.recovered.cents)}`} />
        <div
          className="fade-on-clear bg-[#B8B8B8]"
          style={{
            width: `${pct(b.cleared.cents)}%`,
            backgroundImage: "repeating-linear-gradient(45deg,#B8B8B8 0,#B8B8B8 2px,#E5E5E5 2px,#E5E5E5 6px)",
          }}
          title={`Cleared ${fmt(b.cleared.cents)}`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#5B5F68]">
        <span><span className="inline-block h-2 w-2 rounded-full bg-[#C22A25]" /> Open {fmt(b.open.cents)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border border-[#C22A25]" /> Sent {fmt(b.sent.cents)}</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-[#17734B]" /> Recovered {fmt(b.recovered.cents)}</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-[#B8B8B8]" /> Cleared by data {fmt(b.cleared.cents)}</span>
      </div>
    </div>
  );
}
