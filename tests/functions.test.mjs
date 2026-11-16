// End-to-end through the local Base44 stand-in: resetDemo -> importRows x4 -> runChecks -> twist -> runChecks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localBase44 as base44, setLocalUser } from "../src/lib/local/localBase44.js";
import { parseCsv, headerHash } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/clean/", import.meta.url).pathname;
const file = (f) => parseCsv(readFileSync(`${DATA}${f}.csv`, "utf8"));
const SEED = { Contract: "crm_contracts", Shipment: "warehouse_shipments", Invoice: "billing_invoices", VendorBill: "ap_bills" };
const sum = (fs) => fs.reduce((a, f) => a + f.amount_cents, 0);

test("full pipeline through backend functions", async () => {
  setLocalUser({ email: "dana@northline.example", role: "admin" });
  await base44.functions.invoke("resetDemo");
  for (const [E, f] of Object.entries(SEED)) { const { header, rows } = file(f); await base44.functions.invoke("importRows", { entity: E, rows, header_hash: headerHash(header), file_name: f }); }
  const r1 = (await base44.functions.invoke("runChecks")).data;
  assert.equal(r1.counts.new, 24);
  let flags = await base44.entities.Flag.list();
  assert.equal(sum(flags.filter((f) => f.bucket === "recoverable")), 1828094);
  assert.equal((await base44.entities.RuledOut.list()).length, 13);
  assert.equal((await base44.entities.Pattern.list()).length, 4);

  // Dana sends Chelsea's settlement: those flags become "sent"
  const chelsea = flags.filter((f) => f.party === "Chelsea Dental Offices" && f.bucket !== "overdue");
  for (const f of chelsea) await base44.entities.Flag.update(f.id, { status: "sent" });

  // Twist: import returns, approve the three templates, re-run
  const { header, rows } = file("twist_returns_log");
  await base44.functions.invoke("importRows", { entity: "Return", rows, header_hash: headerHash(header), file_name: "twist_returns_log" });
  const [s] = await base44.entities.Setting.list();
  await base44.entities.Setting.update(s.id, { rule_enabled: { return_offset: true, dup_credit_memo: true, missing_credit: true } });
  const r2 = (await base44.functions.invoke("runChecks")).data;
  assert.equal(r2.counts.new, 2);            // +231.20 over-credit, +170.00 credit never issued
  assert.equal(r2.counts.needs_review, 1);   // Chelsea short-bill was already SENT -> correction owed, not silently cleared
  assert.equal(r2.counts.cleared, 0);
  flags = await base44.entities.Flag.list();
  const live = flags.filter((f) => !["cleared", "needs_review"].includes(f.status));
  assert.equal(sum(live.filter((f) => f.bucket === "recoverable")), 1837603);
  assert.equal(sum(live.filter((f) => f.bucket === "credit_owed")), 35000);
  assert.equal((await base44.entities.AuditEvent.list()).length >= 8, true);
});

test("Analyst cannot run checks", async () => {
  setLocalUser({ email: "analyst@northline.example", role: "user" });
  await assert.rejects(() => base44.functions.invoke("runChecks"), (e) => e.response.status === 403);
  setLocalUser({ email: "dana@northline.example", role: "admin" });
});
