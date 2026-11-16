// M5: letter sections, AI validator, sendLetter gate, four-eyes, outbox.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localBase44 as base44, setLocalUser } from "../src/lib/local/localBase44.js";
import { parseCsv, headerHash } from "../src/lib/csv.js";
import {
  LETTER_CHECKED_CREDITS,
  validateLetterAiText,
  vendorRefundEmail,
} from "../src/lib/engine/engine.js";

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
  // clear outbox from any prior noise
  for (const o of await base44.entities.Outbox.list()) await base44.entities.Outbox.delete(o.id);
}

test("Tribeca letter: credit-only, total −12000, sections[0] is credits", async () => {
  await seedDemo();
  setLocalUser({ email: "analyst@northline.example", role: "user" });
  const { data } = await base44.functions.invoke("buildLetter", {
    party: "Tribeca Grill",
    kind: "customer",
    tone: "warm",
  });
  assert.equal(data.sections[0].title, "Credits we owe you");
  assert.equal(data.total_cents, -12000);
  assert.ok(data.sections[0].lines.some((l) => l.amount_cents === 12000));
  assert.equal(data.sections[1].lines.filter((l) => l.amount_cents).length, 0);
});

test("Chelsea: credits first, total 37611, no We checked", async () => {
  await seedDemo();
  const { data } = await base44.functions.invoke("buildLetter", {
    party: "Chelsea Dental Offices",
    kind: "customer",
  });
  assert.equal(data.sections[0].title, "Credits we owe you");
  assert.equal(data.total_cents, 37611);
  const blob = JSON.stringify(data.sections);
  assert.equal(blob.includes(LETTER_CHECKED_CREDITS), false);
  assert.equal(blob.includes("We checked"), false);
});

test("Lenox Hill: We checked when rule 8 on and no credits", async () => {
  await seedDemo();
  const { data } = await base44.functions.invoke("buildLetter", {
    party: "Lenox Hill Hospital",
    kind: "customer",
  });
  assert.ok(
    data.sections[0].lines.some((l) => l.text === LETTER_CHECKED_CREDITS),
    "expected checked-credits line",
  );
});

test("AI validator rejects digits and bank words", () => {
  assert.equal(validateLetterAiText("Call 555-0100"), false);
  assert.equal(validateLetterAiText("update your bank details"), false);
  assert.equal(validateLetterAiText("Thank you for your partnership."), true);
});

test("sendLetter twice for Chelsea → second call 409", async () => {
  await seedDemo();
  const built = (await base44.functions.invoke("buildLetter", { party: "Chelsea Dental Offices" })).data;
  await base44.functions.invoke("sendLetter", {
    party: "Chelsea Dental Offices",
    kind: "customer",
    total_cents: built.total_cents,
  });
  await assert.rejects(
    () => base44.functions.invoke("sendLetter", {
      party: "Chelsea Dental Offices",
      kind: "customer",
      total_cents: built.total_cents,
    }),
    (e) => e.response.status === 409,
  );
});

test("Total mismatch → 409", async () => {
  await seedDemo();
  await assert.rejects(
    () => base44.functions.invoke("sendLetter", {
      party: "Tribeca Grill",
      kind: "customer",
      total_cents: 999,
    }),
    (e) => e.response.status === 409 && /mismatch/i.test(e.response.data.error),
  );
});

test("Hudson Paper refund → pending_second; same user 403; other admin sends", async () => {
  await seedDemo();
  const built = (await base44.functions.invoke("buildLetter", {
    party: "Hudson Paper Co",
    kind: "vendor",
  })).data;
  assert.equal(built.total_cents, 624000);
  assert.equal(built.to, vendorRefundEmail("Hudson Paper Co"));

  const first = (await base44.functions.invoke("sendLetter", {
    party: "Hudson Paper Co",
    kind: "vendor",
    total_cents: built.total_cents,
  })).data;
  assert.ok(first.pending_second);

  await assert.rejects(
    () => base44.functions.invoke("approveSecond", { action_id: first.pending_second }),
    (e) => e.response.status === 403,
  );

  setLocalUser({ email: "controller2@northline.example", role: "admin" });
  const approved = (await base44.functions.invoke("approveSecond", {
    action_id: first.pending_second,
  })).data;
  assert.ok(approved.letter_id);
  assert.ok(approved.sha256 && approved.sha256.length === 64);
  setLocalUser({ email: "dana@northline.example", role: "admin" });
});

test("Outbox has exactly the expected emails after Tribeca + Chelsea + Hudson", async () => {
  await seedDemo();
  const trib = (await base44.functions.invoke("buildLetter", { party: "Tribeca Grill" })).data;
  await base44.functions.invoke("sendLetter", {
    party: "Tribeca Grill",
    total_cents: trib.total_cents,
  });
  const chel = (await base44.functions.invoke("buildLetter", { party: "Chelsea Dental Offices" })).data;
  await base44.functions.invoke("sendLetter", {
    party: "Chelsea Dental Offices",
    total_cents: chel.total_cents,
  });
  const hud = (await base44.functions.invoke("buildLetter", {
    party: "Hudson Paper Co",
    kind: "vendor",
  })).data;
  const pending = (await base44.functions.invoke("sendLetter", {
    party: "Hudson Paper Co",
    kind: "vendor",
    total_cents: hud.total_cents,
  })).data;
  setLocalUser({ email: "controller2@northline.example", role: "admin" });
  await base44.functions.invoke("approveSecond", { action_id: pending.pending_second });

  const outbox = await base44.entities.Outbox.list();
  const tos = outbox.map((o) => o.to).sort();
  assert.deepEqual(tos, [
    "admin@chelseadental.example",
    "ap@hudsonpaperco.example",
    "office@tribecagrill.example",
  ]);
  assert.equal(outbox.length, 3);
});
