// M3: lookupRecord — ruled out, flagged short_billed, not found, digits-only order match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localBase44 as base44, setLocalUser } from "../src/lib/local/localBase44.js";
import { parseCsv, headerHash } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/clean/", import.meta.url).pathname;
const file = (f) => parseCsv(readFileSync(`${DATA}${f}.csv`, "utf8"));
const SEED = { Contract: "crm_contracts", Shipment: "warehouse_shipments", Invoice: "billing_invoices", VendorBill: "ap_bills" };

async function seedDemo() {
  setLocalUser({ email: "dana@northline.example", role: "admin" });
  await base44.functions.invoke("resetDemo");
  for (const [E, f] of Object.entries(SEED)) {
    const { header, rows } = file(f);
    await base44.functions.invoke("importRows", { entity: E, rows, header_hash: headerHash(header), file_name: f });
  }
  await base44.functions.invoke("runChecks");
}

test("lookup INV-5076 is ruled_out (invoice-date price)", async () => {
  await seedDemo();
  setLocalUser({ email: "analyst@northline.example", role: "user" });
  const { data } = await base44.functions.invoke("lookupRecord", { id: "INV-5076" });
  assert.equal(data.kind, "ruled_out");
  assert.ok(data.ruled.length >= 1);
  assert.ok(data.ruled.some((r) => /invoice-date price/i.test(r.reason)));
});

test("lookup SH-3060 is flagged short_billed with diff_field qty", async () => {
  await seedDemo();
  const { data } = await base44.functions.invoke("lookupRecord", { id: "SH-3060" });
  assert.equal(data.kind, "flagged");
  assert.ok(data.flags.some((f) => f.rule_id === "short_billed" && f.diff_field === "qty"));
});

test("lookup XYZ-999 is not_found", async () => {
  await seedDemo();
  const { data } = await base44.functions.invoke("lookupRecord", { id: "XYZ-999" });
  assert.equal(data.kind, "not_found");
  assert.equal(data.flags.length, 0);
  assert.equal(data.ruled.length, 0);
});

test("lookup 'so 1060' finds SO-1060 (digits-only)", async () => {
  await seedDemo();
  const { data } = await base44.functions.invoke("lookupRecord", { id: "so 1060" });
  assert.equal(data.kind, "flagged");
  const hit = data.flags.some((f) =>
    (f.ids || []).some((id) => /1060/.test(id))
    || (f.evidence || []).some((ev) => /1060/.test(String(ev.id)) || /1060/.test(String(ev.fields?.order || ""))));
  assert.ok(hit, "expected a flag tied to SO-1060");
});
