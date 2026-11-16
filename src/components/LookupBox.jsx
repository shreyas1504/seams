// Lookup — compact, AA contrast, labeled controls.
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

export default function LookupBox({ onOpenFlag }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (e) => {
    e?.preventDefault?.();
    setErr("");
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke("lookupRecord", { id: q });
      setResult(data);
    } catch (ex) {
      setErr(ex?.response?.data?.error || ex.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="seam-card p-3">
      <form onSubmit={run} className="flex gap-2" role="search" aria-label="Record lookup">
        <label className="sr-only" htmlFor="lookup-q">
          Look up invoice, shipment, bill or order
        </label>
        <input
          id="lookup-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="INV-5076, SH-3060, SO-1060…"
          className="min-h-[44px] flex-1 rounded-xl border border-[#C8C8D0] bg-white px-3 text-sm font-medium text-[#0A0A0A] placeholder:text-[#4A4A52]"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="seam-btn-blue min-w-[88px] px-3 text-sm disabled:opacity-45"
        >
          Look up
        </button>
      </form>
      {err ? (
        <p className="mt-2 text-xs font-semibold text-[#B42318]" role="alert">
          {err}
        </p>
      ) : null}
      {result?.kind === "not_found" ? (
        <p className="mt-2 text-sm font-medium text-[#4A4A52]" role="status">
          Not found in any of the 4 systems
        </p>
      ) : null}
      {result?.kind === "ruled_out" ? (
        <div className="mt-2 space-y-1.5" role="region" aria-label="Ruled out results">
          <p className="text-sm font-bold">Ruled out</p>
          {result.ruled.map((r, i) => (
            <div key={i} className="rounded-xl bg-[#ECECF0] px-2.5 py-2 text-xs font-medium text-[#4A4A52]">
              <span className="font-bold text-[#0A0A0A]">{r.rule}:</span> {r.reason}
              {r.ids?.length ? <p className="mt-1 font-mono">{r.ids.join(" · ")}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {result?.kind === "flagged" ? (
        <div className="mt-2 space-y-2" role="region" aria-label="Flagged results">
          <p className="text-sm font-bold">Flagged</p>
          {result.flags.map((f) => (
            <div key={f.id || f.stable_key}>
              <button
                type="button"
                onClick={() => onOpenFlag?.(f)}
                className="flex min-h-[40px] w-full items-center justify-between text-left text-xs font-medium"
              >
                <span>
                  {f.rule} · {f.party}
                </span>
                <span className="font-mono font-bold text-[#B42318]">{fmt(f.amount_cents)}</span>
              </button>
              <SideBySide flag={f} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
