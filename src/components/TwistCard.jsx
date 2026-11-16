// H / 6.7 — Twist card after a Return import: dry run, approve, revoke, load reviewed spec.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { TWIST_SPEC } from "@/lib/twistSpec.js";
import { fmt } from "@/lib/engine/engine.js";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";

export default function TwistCard({
  fileName = TWIST_SPEC.file_hint,
  rowsParsed,
  rowsImported,
  role = "admin",
  onDone,
  approved = false,
}) {
  const [spec, setSpec] = useState(TWIST_SPEC);
  const [dry, setDry] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const adminOnly = role !== "admin";
  const twistLock = useRef(false);
  useEffect(() => { if (!adminOnly) runDry(); }, [rowsImported, fileName, approved, role]);

  async function runDry() {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await base44.functions.invoke("applyRuleSpec", { mode: "dry_run" });
      setDry(data);
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(mode) {
    if (adminOnly || twistLock.current) return;
    twistLock.current = true;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await base44.functions.invoke("applyRuleSpec", { mode });
      setMsg(mode === "approve" ? "Rules approved and checks re-run." : "Rules revoked and checks re-run.");
      announceSeamsDataChanged();
      onDone?.({ ...data, dry }, mode);
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message);
    } finally {
      twistLock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="twist-preview">
      <h2 className="font-display text-[20px] font-semibold">New checks Seams proposes</h2>
      <p className="mt-1 text-xs text-[#5B5F68]">
        {fileName}
        {rowsParsed != null ? ` · rows parsed ${rowsParsed}` : ""}
        {rowsImported != null ? ` · imported ${rowsImported}` : ""}
      </p>
      <ul className="mt-3 space-y-2">
        {spec.rules.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white/80 p-3 text-sm">
            <div className="font-medium text-[#14171F]">{r.title}</div>
            <p className="mt-1 text-xs text-[#5B5F68]">{r.plain}</p>
          </li>
        ))}
      </ul>

      {dry ? (
        <div className="twist-numbers" aria-label="Dry run preview">
          <p className="text-xs text-muted col-span-full">Dry run · nothing changes until you approve</p>
          <div><strong className="money">{dry.cleared?.length || 0}</strong><small>cleared ({fmt((dry.cleared || []).reduce((a,f)=>a+f.amount_cents,0))})</small></div>
          <div><strong className="money text-owed">+{fmt((dry.new_recoverable || []).reduce((a,f)=>a+f.amount_cents,0))}</strong><small>owed to us</small></div>
          <div><strong className="money text-credit">+{fmt((dry.new_credit || []).reduce((a,f)=>a+f.amount_cents,0))}</strong><small>we owe</small></div>
          <div><strong className="money">{dry.trap_hits?.length || 0}</strong><small>look-alikes hit</small></div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={runDry}
          className="min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white"
        >
          Dry run
        </button>
        <button
          type="button"
          disabled={busy || adminOnly || !dry}
          title={adminOnly ? "Controller only" : undefined}
          onClick={() => act("approve")}
          className="min-h-[44px] rounded-2xl bg-[#3B5BDB] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Working…" : "Approve new checks"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMsg("Rejected — twist rules left off.")}
          className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-4 text-sm"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSpec(TWIST_SPEC);
            setMsg("Loaded reviewed spec.");
          }}
          className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-4 text-sm"
        >
          Load reviewed spec
        </button>
        {approved ? <button
          type="button"
          disabled={busy || adminOnly}
          title={adminOnly ? "Controller only" : undefined}
          onClick={() => act("revoke")}
          className="min-h-[44px] rounded-2xl border border-[#C22A25] px-4 text-sm text-[#C22A25] disabled:opacity-40"
        >
          Revoke
        </button> : null}
      </div>
      {adminOnly ? <p className="mt-2 text-xs text-[#8A5A00]">Controller only</p> : null}
      {msg ? <p className="mt-2 text-xs text-[#5B5F68]">{msg}</p> : null}
    </div>
  );
}
