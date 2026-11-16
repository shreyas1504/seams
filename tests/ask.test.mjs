// M7: Ask Seams seed answers + suggested actions do not mutate until Approve.
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

async function seed() {
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
}

test("Ask Seams seed answers", async () => {
  await seed();

  const owe = (await base44.functions.invoke("askSeams", { question: "Which customers do we owe money to?" })).data;
  assert.match(owe.answer, /Tribeca Grill \$120\.00 \(INV-5074\)/);
  assert.match(owe.answer, /Chelsea Dental Offices \$60\.00 \(INV-5075\)/);
  assert.match(owe.answer, /total \$180\.00/);

  const why = (await base44.functions.invoke("askSeams", {
    question: "Why wasn't the Bronx Realty rent flagged?",
  })).data;
  assert.match(why.answer, /Ruled out/i);
  assert.match(why.answer, /8,500\.00|8500/);
  assert.match(why.answer, /recurring/i);

  const fix = (await base44.functions.invoke("askSeams", { question: "Fix the Chelsea towels" })).data;
  assert.match(fix.answer, /Send corrected invoice for \$136\.11 to Chelsea Dental Offices/);
  assert.ok(fix.suggested_action_id);
  const flagsBefore = await base44.entities.Flag.list();
  const statuses = Object.fromEntries(flagsBefore.map((f) => [f.id, f.status]));

  // Flags unchanged until executeAction
  const flagsMid = await base44.entities.Flag.list();
  for (const f of flagsMid) assert.equal(f.status, statuses[f.id]);

  setLocalUser({ email: "analyst@northline.example", role: "user" });
  await assert.rejects(
    () => base44.functions.invoke("executeAction", { action_id: fix.suggested_action_id }),
    (e) => e.response.status === 403,
  );
  setLocalUser({ email: "dana@northline.example", role: "admin" });

  // Import returns for "what changed" seed
  const { header, rows } = file("twist_returns_log");
  await base44.functions.invoke("importRows", {
    entity: "Return",
    rows,
    header_hash: headerHash(header),
    file_name: "twist_returns_log",
  });
  const changed = (await base44.functions.invoke("askSeams", {
    question: "What changed after the returns file?",
  })).data;
  assert.match(changed.answer, /1 cleared \(\$136\.11\)/);
  assert.match(changed.answer, /\+\$231\.20/);
  assert.match(changed.answer, /\+\$170\.00/);

  const refused = (await base44.functions.invoke("askSeams", { question: "Forecast next quarter" })).data;
  assert.equal(refused.refused, true);
  assert.match(refused.answer, /checked records/i);
});
