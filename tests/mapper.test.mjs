// M2: fuzzy mapping for messy headers + date normalization.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv.js";
import {
  fuzzyMapHeaders,
  normalizeDateValue,
  applyColumnMap,
} from "../src/lib/mapping.js";

const DATA = new URL("../tools/data/", import.meta.url).pathname;

const EXPECTED = {
  "crm_contracts.csv": {
    entity: "Contract",
    map: {
      "Contract #": "contract_id",
      "Account Name": "customer_name",
      "Item Code": "sku",
      "Agreed Price ($)": "contract_price",
      "Effective From": "start_date",
      "Effective To": "end_date",
      "Pass-through Freight?": "rebill_freight",
      "Net Terms": "payment_terms_days",
      "AP Contact Email": "billing_email",
    },
  },
  "warehouse_shipments.csv": {
    entity: "Shipment",
    map: {
      "Ship ID": "shipment_id",
      "Sales Order": "order_no",
      "Ship To": "ship_to",
      Item: "sku",
      "Qty Shipped": "qty",
      "Ship Dt": "ship_date",
      "Shipment Type": "ship_type",
      "Carrier Cost": "freight_cost",
    },
  },
  "billing_invoices.csv": {
    entity: "Invoice",
    map: {
      "Inv #": "invoice_no",
      "Customer PO / SO Ref": "order_ref",
      "Bill To": "customer",
      Product: "sku",
      "Qty Billed": "qty",
      Rate: "unit_price",
      "Shipping Charged": "freight_billed",
      "Invoice Total": "amount",
      "Inv Date": "invoice_date",
      Due: "due_date",
      "Payment Status": "status",
      "Date Paid": "paid_date",
    },
  },
  "ap_bills.csv": {
    entity: "VendorBill",
    map: {
      "Bill ID": "bill_id",
      Supplier: "vendor",
      "Supplier Inv No": "vendor_invoice_no",
      "Bill Dt": "bill_date",
      "Amount Paid": "amount",
      "PO Number": "po_no",
      "PO Value": "po_amount",
      "Payment Ref": "payment_id",
      "Payment Dt": "paid_date",
    },
  },
};

for (const [file, exp] of Object.entries(EXPECTED)) {
  test(`fuzzy maps messy headers in ${file}`, () => {
    const { header } = parseCsv(readFileSync(`${DATA}messy_headers/${file}`, "utf8"));
    const column_map = fuzzyMapHeaders(header, exp.entity);
    const got = Object.fromEntries(column_map.map((m) => [m.source_col, m.maps_to]));
    for (const [src, dest] of Object.entries(exp.map)) {
      assert.equal(got[src], dest, `${file}: ${src} → expected ${dest}, got ${got[src]}`);
    }
  });
}

test("date normalization turns 09/15/2026 into 2026-09-15", () => {
  assert.equal(normalizeDateValue("09/15/2026", "MDY"), "2026-09-15");
  assert.equal(normalizeDateValue("15/09/2026", "DMY"), "2026-09-15");
});

test("applyColumnMap remaps and normalizes dates", () => {
  const rows = [{ "Inv Date": "09/15/2026", "Inv #": "INV-1" }];
  const out = applyColumnMap(
    rows,
    [
      { source_col: "Inv Date", maps_to: "invoice_date" },
      { source_col: "Inv #", maps_to: "invoice_no" },
    ],
    "MDY",
  );
  assert.deepEqual(out[0], { invoice_date: "2026-09-15", invoice_no: "INV-1" });
});
