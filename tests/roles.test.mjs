// M8: Analyst 403 on admin functions; user-level functions allowed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localBase44 as base44, setLocalUser } from "../src/lib/local/localBase44.js";
import { parseCsv, headerHash } from "../src/lib/csv.js";

const DATA = new URL("../tools/data/clean/", import.meta.url).pathname;
const file = (f) => parseCsv(readFileSync(`${DATA}${f}.csv`, "utf8"));

async function seedAsAdmin() {
  setLocalUser({ email: "dana@northline.example", role: "admin" });
  await base44.functions.invoke("resetDemo");
  for (const [E, f] of Object.entries({
    Contract: "crm_contracts",
    Shipment: "warehouse_shipments",
    Invoice: "billing_invoices",
    VendorBill: "ap_bills",
  })) {
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

test("Analyst forbidden vs allowed", async () => {
  await seedAsAdmin();
  const flags = await base44.entities.Flag.list();
  const open = flags.find((f) => f.status === "open");
  const audits = await base44.entities.AuditEvent.list();
  const reversible = audits.find((e) => e.reversible && !e.undone);

  setLocalUser({ email: "analyst@northline.example", role: "user" });

  for (const [name, payload] of [
    ["runChecks", {}],
    ["sendLetter", { party: "Tribeca Grill", kind: "customer", tone: "warm", exclude_keys: [] }],
    ["applyRuleSpec", { mode: "dry_run" }],
    ["executeAction", { action_id: "x" }],
    ["undoAction", { audit_event_id: reversible?.id || "x" }],
    ["saveMapping", { header_hash: "h", target_entity: "Invoice", column_map: [] }],
    ["resetDemo", {}],
  ]) {
    await assert.rejects(
      () => base44.functions.invoke(name, payload),
      (e) => e.response?.status === 403,
      `${name} should 403`,
    );
  }

  const letter = await base44.functions.invoke("buildLetter", {
    party: "Tribeca Grill",
    kind: "customer",
    tone: "warm",
    exclude_keys: [],
  });
  assert.ok(letter.data);

  const lookup = await base44.functions.invoke("lookupRecord", { id: "INV-5076" });
  assert.equal(lookup.data.kind, "ruled_out");

  const ask = await base44.functions.invoke("askSeams", {
    question: "Which customers do we owe money to?",
  });
  assert.match(ask.data.answer, /Tribeca Grill/);

  if (open) {
    const tr = await base44.functions.invoke("transitionFlag", {
      flag_id: open.id,
      to_status: "dismissed",
      reason: "Not a leak",
    });
    assert.ok(tr.data.flag);
  }

  setLocalUser({ email: "dana@northline.example", role: "admin" });
});
