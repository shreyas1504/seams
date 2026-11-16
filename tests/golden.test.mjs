// Run: node --test tests/   (no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runEngine, DEFAULT_SETTINGS, rankParties } from "../src/lib/engine/engine.js";
import { parseCsv } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/", import.meta.url).pathname;
const load = (f) => parseCsv(readFileSync(`${DATA}clean/${f}.csv`, "utf8")).rows;
const data = () => ({ contracts: load("crm_contracts"), shipments: load("warehouse_shipments"),
  invoices: load("billing_invoices"), bills: load("ap_bills"), returns: [] });
const TWIST = { return_offset: true, dup_credit_memo: true, missing_credit: true };
const ref = (twist) => JSON.parse(execFileSync("python3", ["-I", `${DATA}reference_checks.py`, `${DATA}clean`, "--json", ...(twist ? ["--twist"] : [])], { encoding: "utf8" }));
const sig = (f) => `${f.amount_cents}|${f.bucket}|${f.party}|${[...f.ids].sort().join(",")}`;

for (const twist of [false, true]) {
  test(`engine matches reference_checks.py ${twist ? "after" : "before"} twist`, () => {
    const d = data(); if (twist) d.returns = load("twist_returns_log");
    const out = runEngine(d, { ...DEFAULT_SETTINGS, rule_enabled: twist ? TWIST : {} });
    const r = ref(twist);
    assert.deepEqual(out.flags.map(sig).sort(), r.flags.map(sig).sort(), "flag set differs");
    assert.equal(out.ruledOut.length, r.ruled_out, "ruled-out count differs");
    assert.equal(out.patterns.length, r.patterns.length, "pattern count differs");
  });
}

test("golden numbers before twist", () => {
  const t = runEngine(data()).totals;
  assert.deepEqual([t.recoverable.n, t.recoverable.cents], [17, 1828094]);
  assert.deepEqual([t.overdue.n, t.overdue.cents], [5, 1397799]);
  assert.deepEqual([t.credit_owed.n, t.credit_owed.cents], [2, 18000]);
  assert.equal(t.ruled_out, 13);
  assert.equal(t.by_seam["AP→Vendors"].cents, 1136040);
  assert.equal(t.by_seam["Warehouse→Billing"].cents, 488754);
  assert.equal(t.by_seam["CRM→Billing"].cents, 203300);
});

test("golden numbers after twist", () => {
  const d = data(); d.returns = load("twist_returns_log");
  const out = runEngine(d, { ...DEFAULT_SETTINGS, rule_enabled: TWIST });
  const t = out.totals;
  assert.deepEqual([t.recoverable.n, t.recoverable.cents], [17, 1837603]);
  assert.deepEqual([t.credit_owed.n, t.credit_owed.cents], [3, 35000]);
  assert.equal(t.ruled_out, 16);
  assert.equal(out.patterns.length, 5);
});

test("customer nets and ranking", () => {
  const { customers, vendors } = rankParties(runEngine(data()).flags);
  const net = Object.fromEntries(customers.map((c) => [c.party, c.net]));
  assert.equal(net["Lenox Hill Hospital"], 240790);
  assert.equal(net["Chelsea Dental Offices"], 37611);
  assert.equal(net["Tribeca Grill"], -12000);
  assert.equal(customers[0].party, "Lenox Hill Hospital");
  assert.deepEqual(vendors.map((v) => v.net), [624000, 336840, 95000, 80200]);
});

test("patterns before twist", () => {
  const p = runEngine(data()).patterns;
  const g = p.find((x) => x.key === "glove_price_9_15");
  assert.equal(g.amount_cents, 144000);
  assert.equal(p.length, 4);
});

test("every flag explains how it was caught", () => {
  for (const f of runEngine(data()).flags) {
    assert.ok(f.why.includes("$"), `${f.stable_key} why has no amount`);
    assert.ok(f.evidence.length >= 1 && f.diff_field, `${f.stable_key} missing evidence/diff_field`);
  }
});
