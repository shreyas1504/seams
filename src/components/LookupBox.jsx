// H1 lookup box + results (flagged / ruled out / not found).
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
    <div className="rounded-[24px] border border-[#E2DDD2] bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Look up any invoice, shipment, bill or order"
          className="min-h-[44px] flex-1 rounded-2xl border border-[#E2DDD2] bg-[#F6F3EC] px-3 text-sm"
          aria-label="Record lookup"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="min-h-[44px] rounded-2xl bg-[#3B5BDB] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Look up
        </button>
      </form>
      {err ? <p className="mt-2 text-xs text-[#C22A25]">{err}</p> : null}
      {result?.kind === "not_found" ? (
        <p className="mt-3 text-sm text-[#5B5F68]">Not found in any of the 4 systems</p>
      ) : null}
      {result?.kind === "ruled_out" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-[#14171F]">Ruled out</p>
          {result.ruled.map((r, i) => (
            <div key={i} className="rounded-2xl border border-[#E2DDD2] bg-[#F6F3EC] px-3 py-2 text-xs text-[#5B5F68]">
              <span className="font-medium text-[#14171F]">{r.rule}:</span> {r.reason}
              {r.ids?.length ? <p className="mt-1 font-mono">{r.ids.join(" · ")}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {result?.kind === "flagged" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-semibold text-[#14171F]">Flagged</p>
          {result.flags.map((f) => (
            <div key={f.id || f.stable_key}>
              <button
                type="button"
                onClick={() => onOpenFlag?.(f)}
                className="flex w-full items-center justify-between text-left text-xs"
              >
                <span className="text-[#14171F]">{f.rule} · {f.party}</span>
                <span className="font-mono text-[#C22A25]">{fmt(f.amount_cents)}</span>
              </button>
              <SideBySide flag={f} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
