// M1: board values by seam and customer order from rankParties.
// M9: reconcile — sum of flags by bucket matches totalsOf.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runEngine, rankParties, totalsOf } from "../src/lib/engine/engine.js";
import { parseCsv } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/", import.meta.url).pathname;
const load = (f) => parseCsv(readFileSync(`${DATA}clean/${f}.csv`, "utf8")).rows;
const data = () => ({
  contracts: load("crm_contracts"),
  shipments: load("warehouse_shipments"),
  invoices: load("billing_invoices"),
  bills: load("ap_bills"),
  returns: [],
});

test("home board values by seam and customer order", () => {
  const out = runEngine(data());
  const live = out.flags;
  const bySeam = (seam) => live.filter((f) => f.seam === seam && f.bucket === "recoverable");
  const sum = (fs) => fs.reduce((a, f) => a + f.amount_cents, 0);

  assert.equal(sum(bySeam("AP→Vendors")), 1136040);
  assert.equal(sum(bySeam("Warehouse→Billing")), 488754);
  assert.equal(sum(bySeam("CRM→Billing")), 203300);

  const { customers } = rankParties(live);
  assert.equal(customers[0].party, "Lenox Hill Hospital");
  const tribeca = customers.find((c) => c.party === "Tribeca Grill");
  assert.ok(tribeca);
  assert.equal(tribeca.net, -12000);
});

test("reconcile: sum of flags by bucket matches totalsOf", () => {
  const out = runEngine(data());
  const totals = totalsOf(out.flags, out.ruledOut);
  for (const bucket of ["recoverable", "overdue", "credit_owed"]) {
    const sum = out.flags
      .filter((f) => f.bucket === bucket)
      .reduce((a, f) => a + f.amount_cents, 0);
    assert.equal(sum, totals[bucket].cents, `${bucket} cents`);
    assert.equal(
      out.flags.filter((f) => f.bucket === bucket).length,
      totals[bucket].n,
      `${bucket} count`,
    );
  }
  assert.equal(totals.ruled_out, out.ruledOut.length);
});
