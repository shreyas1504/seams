// Starter Data page: Reset demo (seed), CSV upload with header mapping by exact canonical names (M1 adds the AI-suggested mapper).
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { parseCsv, headerHash } from "@/lib/csv.js";

const SEED = { Contract: "crm_contracts", Shipment: "warehouse_shipments", Invoice: "billing_invoices", VendorBill: "ap_bills" };
const err = (e) => e?.response?.data?.error || e.message;

export default function Data() {
  const [log, setLog] = useState([]);
  const say = (m) => setLog((l) => [...l, m]);
  async function resetDemo() {
    setLog([]);
    try {
      await base44.functions.invoke("resetDemo");
      for (const [entity, f] of Object.entries(SEED)) {
        const { header, rows } = parseCsv(await (await fetch(`/seed/${f}.csv`)).text());
        const r = await base44.functions.invoke("importRows", { entity, rows, header_hash: headerHash(header), file_name: f });
        say(`${entity}: ${r.data.imported} rows`);
      }
      const c = await base44.functions.invoke("runChecks");
      say(`Checks: ${c.data.counts.new} new flags · recoverable ${c.data.totals.recoverable.n} · ruled out ${c.data.totals.ruled_out}`);
    } catch (e) { say(`Error: ${err(e)}`); }
  }
  async function upload(e, entity) {
    const file = e.target.files[0]; if (!file) return;
    const { header, rows } = parseCsv(await file.text());
    try {
      const r = await base44.functions.invoke("importRows", { entity, rows, header_hash: headerHash(header), file_name: file.name });
      say(`${file.name}: ${rows.length} rows parsed, ${r.data.imported} imported into ${entity}`);
      const c = await base44.functions.invoke("runChecks");
      say(`Checks: ${c.data.counts.new} new · ${c.data.counts.cleared} cleared · ${c.data.counts.needs_review} need review`);
    } catch (e2) { say(`Error: ${err(e2)}`); }
  }
  return (
    <div className="rounded-xl border border-[#E2DDD2] bg-white p-4 text-sm">
      <button onClick={resetDemo} className="rounded bg-[#14171F] px-3 py-2 text-white">Reset demo (load mock data)</button>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {["Contract", "Shipment", "Invoice", "VendorBill", "Return"].map((E) => (
          <label key={E} className="block">Import {E} CSV <input type="file" accept=".csv" onChange={(e) => upload(e, E)} className="block" /></label>
        ))}
      </div>
      <pre className="mt-4 whitespace-pre-wrap font-mono text-xs">{log.join("\n")}</pre>
    </div>
  );
}
