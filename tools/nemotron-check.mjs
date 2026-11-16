// Test Ask Seams with real NVIDIA Nemotron from a terminal, before Base44. The key stays in your shell.
//   NVIDIA_API_KEY=nvapi-... node tools/nemotron-check.mjs
//   NVIDIA_API_KEY=nvapi-... node tools/nemotron-check.mjs "who's been shorting us?"
import { readFileSync } from "node:fs";
if (!process.env.NVIDIA_API_KEY) {
  console.error("Set NVIDIA_API_KEY first (in Replit: Secrets, or export NVIDIA_API_KEY=nvapi-...).");
  process.exit(1);
}
globalThis.Deno = { env: { get: (k) => process.env[k] } }; // what Base44's Deno runtime provides
const { localBase44: base44, setLocalUser } = await import("../src/lib/local/localBase44.js");
const { parseCsv, headerHash } = await import("../src/lib/csv.js");
const DATA = new URL("./data/clean/", import.meta.url).pathname;
setLocalUser({ email: "dana@northline.example", role: "admin" });
await base44.functions.invoke("resetDemo");
for (const [E, f] of Object.entries({ Contract: "crm_contracts", Shipment: "warehouse_shipments", Invoice: "billing_invoices", VendorBill: "ap_bills" })) {
  const { header, rows } = parseCsv(readFileSync(`${DATA}${f}.csv`, "utf8"));
  await base44.functions.invoke("importRows", { entity: E, rows, header_hash: headerHash(header), file_name: f });
}
await base44.functions.invoke("runChecks");
const questions = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["who's been shorting us?", "which supplier charged us more than agreed?", "anything going on with the hospital?", "give me the damage for this month", "what should I chase first today?"];
for (const q of questions) {
  const t = Date.now();
  const r = (await base44.functions.invoke("askSeams", { question: q, dry_run: true })).data;
  console.log(`\nQ: ${q}\n   routed by: ${r.routed_by} (${Date.now() - t} ms) · intent: ${r.intent}\n   ${r.answer}`);
}
