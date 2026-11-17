// Load our two output files. Replaces Findings and Evidence, keeps Decisions (they join on finding_id),
// which is exactly the 7 PM October step: re-run the code, reload here, nothing rebuilt.
import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { parseCsv } from "@/lib/csv.js";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { useEntity } from "@/lib/useEntity";

const KIT_FINDING_COLS = ["finding_id", "problem", "delivery_id", "invoice_no", "sku", "po_no", "bill_id", "supplier", "message_id", "amount", "month", "cause", "party", "category", "explanation", "action_type", "date"];

async function kitReplace(entity, rows, say) {
  const old = await base44.entities[entity].list(undefined, 20000);
  say(`${entity}: removing ${old.length} old rows…`);
  let cleared = false;
  if (old.length && base44.entities[entity].deleteMany) {
    try { await base44.entities[entity].deleteMany({}); cleared = true; } catch { /* fall back to one by one */ }
  }
  if (!cleared) for (let i = 0; i < old.length; i += 50) await Promise.all(old.slice(i, i + 50).map((r) => base44.entities[entity].delete(r.id)));
  for (let i = 0; i < rows.length; i += 200) {
    await base44.entities[entity].bulkCreate(rows.slice(i, i + 200));
    say(`${entity}: ${Math.min(rows.length, i + 200)} of ${rows.length} loaded`);
  }
}

export default function KitData({ role }) {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState({ findings: null, evidence: null });
  const [findings] = useEntity("Finding");
  const [evidence] = useEntity("Evidence");
  const [decisions] = useEntity("Decision");
  const fIn = useRef(null);
  const eIn = useRef(null);
  const say = (m) => setLog((l) => [...l.slice(-12), m]);

  const load = async (fText, eText) => {
    setBusy(true);
    setLog([]);
    try {
      const f = parseCsv(fText);
      const e = parseCsv(eText);
      if (!f.header.includes("finding_id") || !f.header.includes("amount")) throw new Error("findings.csv needs finding_id and amount columns");
      if (!e.header.includes("finding_id")) throw new Error("evidence.csv needs a finding_id column");
      const fRows = f.rows.map((r) => {
        const o = {};
        for (const k of KIT_FINDING_COLS) o[k] = k === "amount" ? Number(r[k] || 0) : String(r[k] ?? "");
        return o;
      });
      const eRows = e.rows.map((r) => ({ finding_id: r.finding_id, file: r.file || "", record: r.record || "", shows: r.shows || "", expected: r.expected || "" }));
      await kitReplace("Finding", fRows, say);
      await kitReplace("Evidence", eRows, say);
      const total = fRows.reduce((a, r) => a + Math.round(r.amount * 100), 0) / 100;
      say(`Done: ${fRows.length} findings ($${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} net), ${eRows.length} evidence rows. Decisions kept.`);
      announceSeamsDataChanged();
    } catch (err) {
      say(`Stopped: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const fromFiles = async () => {
    if (!files.findings || !files.evidence) return say("Pick both files first.");
    await load(await files.findings.text(), await files.evidence.text());
  };
  const fromDemo = async () => {
    try {
      const [f, e] = await Promise.all(["findings", "evidence"].map((n) => fetch(`/seed/kit/${n}.csv`).then((r) => {
        if (!r.ok || /html/.test(r.headers.get("content-type") || "")) throw new Error(`${n}.csv is not served here; use the file pickers`);
        return r.text();
      })));
      await load(f, e);
    } catch (err) {
      say(`Stopped: ${err.message}`);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="card p-6 lg:col-span-7">
        <p className="brief-label">Load findings</p>
        <h1 className="mt-1 font-display text-[26px] text-[#1C1917]">findings.csv + evidence.csv</h1>
        <p className="mt-1 text-[13px] text-[#6B635A]">Our code reads the raw Northline files, applies billing_rules.md and writes these two files. Loading replaces Findings and Evidence and keeps every Decision, so October needs no rebuild.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[["findings", fIn, "Findings table · Dana's queue"], ["evidence", eIn, "Evidence table · the proof"]].map(([k, ref, sub]) => (
            <label key={k} className={`kit-drop${files[k] ? " is-set" : ""}`}>
              <input ref={ref} type="file" accept=".csv" aria-label={`Choose ${k}.csv`} onChange={(e) => setFiles((s) => ({ ...s, [k]: e.target.files[0] }))} />
              <span className="kit-drop__name">{k}.csv</span>
              <span className="kit-drop__file">{files[k] ? `✓ ${files[k].name}` : sub}</span>
              <span className="kit-drop__file">{files[k] ? "" : "Click to choose a file"}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-forest" disabled={busy || role !== "admin"} onClick={fromFiles}>{busy ? "Loading…" : "Replace findings (keep decisions)"}</button>
          <button type="button" className="fix-quiet" disabled={busy || role !== "admin"} onClick={fromDemo}>Load the September run</button>
        </div>
        {log.length ? (
          <pre className="mt-4 whitespace-pre-wrap rounded-[10px] bg-[#F1ECE4] p-3 text-[12px] text-[#1C1917]" role="status">{log.join("\n")}</pre>
        ) : null}
      </section>
      <section className="card p-6 lg:col-span-5">
        <p className="brief-label">In the app now</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="font-display text-[26px]">{findings.length}</p><p className="text-[11px] text-[#6B635A]">findings</p></div>
          <div><p className="font-display text-[26px]">{evidence.length}</p><p className="text-[11px] text-[#6B635A]">evidence rows</p></div>
          <div><p className="font-display text-[26px]">{decisions.length}</p><p className="text-[11px] text-[#6B635A]">decisions</p></div>
        </div>
        <p className="mt-4 text-[12px] text-[#6B635A]">What we chose not to build: re-checking raw data inside the app. The checks live in code we can re-run and show (kit/detect.py), so every number is reproducible and the app never invents an amount.</p>
      </section>
    </div>
  );
}
