// Shared "Reset demo" logic: wipe, import the four seed CSVs, then runChecks.
// Used by the Data page (Reset demo) and the empty state (Load demo data).
import { base44 } from "@/api/base44Client";
import { parseCsv, headerHash } from "@/lib/csv.js";

export const SEED = {
  Contract: "crm_contracts",
  Shipment: "warehouse_shipments",
  Invoice: "billing_invoices",
  VendorBill: "ap_bills",
};

/** Runs the demo reset. `say` receives one progress line at a time. Returns the runChecks payload. */
export async function loadDemoData(say = () => {}) {
  await base44.functions.invoke("resetDemo");
  for (const [ent, f] of Object.entries(SEED)) {
    const { header, rows } = parseCsv(await (await fetch(`/seed/${f}.csv`)).text());
    const r = await base44.functions.invoke("importRows", {
      entity: ent,
      rows,
      header_hash: headerHash(header),
      file_name: f,
    });
    say(`${ent}: ${r.data.imported} rows`);
  }
  const c = await base44.functions.invoke("runChecks");
  say(
    `Checks: ${c.data.counts.new} new flags · recoverable ${c.data.totals.recoverable.n} · ruled out ${c.data.totals.ruled_out}`,
  );
  return c.data;
}
