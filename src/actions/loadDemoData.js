// Shared "Load demo data / Reset demo" logic: fetch and parse the four seed CSVs FIRST, and only if every one
// parses, wipe and import them, then runChecks. A failed fetch (for example in Base44, which does not serve
// /seed/*.csv) therefore never deletes anything. Used by the empty state, the Data page and the ⌘K palette.
import { base44 } from "@/api/base44Client";
import { announceSeamsDataChanged } from "./dataChanged.js";
import { parseCsv, headerHash } from "@/lib/csv.js";

export const SEED = {
  Contract: "crm_contracts",
  Shipment: "warehouse_shipments",
  Invoice: "billing_invoices",
  VendorBill: "ap_bills",
};

export const DEMO_LOAD_FAILED = "Couldn't load demo data. Nothing was changed.";

async function fetchSeedFile(f) {
  const res = await fetch(`/seed/${f}.csv`);
  const type = res.headers?.get?.("content-type") || "";
  const text = await res.text();
  if (!res.ok || /html/i.test(type) || /^\s*</.test(text)) throw new Error(`${f}.csv not found`);
  const parsed = parseCsv(text);
  if (!parsed.header?.length || !parsed.rows?.length) throw new Error(`${f}.csv is empty`);
  return parsed;
}

/**
 * Loads the demo. `say` receives one progress line at a time. Returns the runChecks payload.
 * Throws DEMO_LOAD_FAILED (with nothing changed) if any seed file is missing or unreadable.
 */
export async function loadDemoData(say = () => {}) {
  const parsed = {};
  try {
    for (const [ent, f] of Object.entries(SEED)) parsed[ent] = await fetchSeedFile(f);
  } catch (e) {
    say(`${DEMO_LOAD_FAILED} (${e.message})`);
    throw new Error(DEMO_LOAD_FAILED);
  }
  await base44.functions.invoke("resetDemo");
  for (const [ent, f] of Object.entries(SEED)) {
    const { header, rows } = parsed[ent];
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
  announceSeamsDataChanged();
  return c.data;
}
