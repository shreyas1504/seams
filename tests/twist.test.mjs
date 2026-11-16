// M6: twist dry run / approve / revoke golden numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localBase44 as base44, setLocalUser } from "../src/lib/local/localBase44.js";
import { parseCsv, headerHash } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/clean/", import.meta.url).pathname;
const file = (f) => parseCsv(readFileSync(`${DATA}${f}.csv`, "utf8"));
const SEED = {
  Contract: "crm_contracts",
  Shipment: "warehouse_shipments",
  Invoice: "billing_invoices",
  VendorBill: "ap_bills",
};
const sum = (fs) => fs.reduce((a, f) => a + f.amount_cents, 0);

async function seedBeforeTwist() {
  setLocalUser({ email: "dana@northline.example", role: "admin" });
  await base44.functions.invoke("resetDemo");
  for (const [E, f] of Object.entries(SEED)) {
    const { header, rows } = file(f);
    await base44.functions.invoke("importRows", {
      entity: E,
      rows,
      header_hash: headerHash(header),
      file_name: f,
    });
  }
  await base44.functions.invoke("runChecks");
  const { header, rows } = file("twist_returns_log");
  await base44.functions.invoke("importRows", {
    entity: "Return",
    rows,
    header_hash: headerHash(header),
    file_name: "twist_returns_log",
  });
}

test("twist dry run / approve / revoke", async () => {
  await seedBeforeTwist();
  const dry = (await base44.functions.invoke("applyRuleSpec", { mode: "dry_run" })).data;
  assert.deepEqual(
    dry.cleared.map((f) => f.amount_cents).sort((a, b) => a - b),
    [13611],
  );
  assert.deepEqual(
    dry.new_recoverable.map((f) => f.amount_cents).sort((a, b) => a - b),
    [23120],
  );
  assert.deepEqual(
    dry.new_credit.map((f) => f.amount_cents).sort((a, b) => a - b),
    [17000],
  );
  assert.deepEqual(dry.trap_hits, []);

  await base44.functions.invoke("applyRuleSpec", { mode: "approve" });
  let flags = await base44.entities.Flag.list();
  let live = flags.filter((f) => !["cleared", "needs_review"].includes(f.status));
  assert.equal(sum(live.filter((f) => f.bucket === "recoverable")), 1837603);
  assert.equal(sum(live.filter((f) => f.bucket === "credit_owed")), 35000);
  assert.equal((await base44.entities.RuledOut.list()).length, 16);
  assert.equal((await base44.entities.Pattern.list()).length, 5);

  await base44.functions.invoke("applyRuleSpec", { mode: "revoke" });
  flags = await base44.entities.Flag.list();
  live = flags.filter((f) => !["cleared", "needs_review"].includes(f.status));
  assert.equal(sum(live.filter((f) => f.bucket === "recoverable")), 1828094);
  assert.equal(sum(live.filter((f) => f.bucket === "credit_owed")), 18000);
  assert.equal((await base44.entities.RuledOut.list()).length, 13);
});

test("twist approve with sent Chelsea line goes to needs_review", async () => {
  await seedBeforeTwist();
  let flags = await base44.entities.Flag.list();
  const chelsea = flags.filter((f) => f.party === "Chelsea Dental Offices" && f.bucket !== "overdue");
  for (const f of chelsea) await base44.entities.Flag.update(f.id, { status: "sent" });
  const r = (await base44.functions.invoke("applyRuleSpec", { mode: "approve" })).data;
  assert.ok(r.checks.counts.needs_review >= 1);
  flags = await base44.entities.Flag.list();
  const short = flags.find((f) => f.rule_id === "short_billed" && f.ids?.includes("SH-3060"));
  assert.ok(short);
  assert.equal(short.status, "needs_review");
});
