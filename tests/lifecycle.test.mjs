// M4: flag lifecycle, undo, roles, overturned count.
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

test("open→dismissed then undo → open (2 AuditEvents)", async () => {
  await seedDemo();
  const flags = await base44.entities.Flag.list();
  const open = flags.find((f) => f.status === "open");
  assert.ok(open);
  const beforeAudits = (await base44.entities.AuditEvent.list()).length;
  const { data } = await base44.functions.invoke("transitionFlag", {
    flag_id: open.id,
    to_status: "dismissed",
    reason: "Not a leak",
  });
  assert.equal(data.flag.status, "dismissed");
  const afterDismiss = await base44.entities.Flag.get(open.id);
  assert.equal(afterDismiss.status, "dismissed");
  await base44.functions.invoke("undoAction", { audit_event_id: data.audit_event_id });
  const restored = await base44.entities.Flag.get(open.id);
  assert.equal(restored.status, "open");
  const audits = await base44.entities.AuditEvent.list();
  assert.equal(audits.length - beforeAudits, 2); // transition + undo
});

test("sent→recovered without reference → 400", async () => {
  await seedDemo();
  const flags = await base44.entities.Flag.list();
  const open = flags.find((f) => f.status === "open");
  await base44.functions.invoke("transitionFlag", { flag_id: open.id, to_status: "sent" });
  await assert.rejects(
    () => base44.functions.invoke("transitionFlag", { flag_id: open.id, to_status: "recovered" }),
    (e) => e.response.status === 400,
  );
});

test("open→recovered → 400 (not allowed)", async () => {
  await seedDemo();
  const flags = await base44.entities.Flag.list();
  const open = flags.find((f) => f.status === "open");
  await assert.rejects(
    () => base44.functions.invoke("transitionFlag", {
      flag_id: open.id,
      to_status: "recovered",
      reference: "PAY-1",
    }),
    (e) => e.response.status === 400,
  );
});

test("Analyst undo → 403", async () => {
  await seedDemo();
  const flags = await base44.entities.Flag.list();
  const open = flags.find((f) => f.status === "open");
  const { data } = await base44.functions.invoke("transitionFlag", {
    flag_id: open.id,
    to_status: "dismissed",
    reason: "Already handled",
  });
  setLocalUser({ email: "analyst@northline.example", role: "user" });
  await assert.rejects(
    () => base44.functions.invoke("undoAction", { audit_event_id: data.audit_event_id }),
    (e) => e.response.status === 403,
  );
  setLocalUser({ email: "dana@northline.example", role: "admin" });
});

test("overturned count = dismissed with reason Not a leak", async () => {
  await seedDemo();
  const flags = await base44.entities.Flag.list();
  const openOnes = flags.filter((f) => f.status === "open").slice(0, 2);
  await base44.functions.invoke("transitionFlag", {
    flag_id: openOnes[0].id,
    to_status: "dismissed",
    reason: "Not a leak",
  });
  await base44.functions.invoke("transitionFlag", {
    flag_id: openOnes[1].id,
    to_status: "dismissed",
    reason: "Already handled",
  });
  const all = await base44.entities.Flag.list();
  const overturned = all.filter((f) => f.status === "dismissed" && f.dismiss_reason === "Not a leak").length;
  assert.equal(overturned, 1);
});
