// Display-only formatting for engine-written sentences (why, ruled-out reasons, letter lines, ⌘K results).
// The engine writes "$6240.00", "18.50" and "2026-09-12"; people read "$6,240.00" and "Sep 12".
// Never use this on values that are sent or compared, only on text shown on screen.
import { fmt, toCents } from "@/lib/engine/engine.js";

const SEAMS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-12" -> "Sep 12". Anything else comes back unchanged. */
export function displayDate(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${SEAMS_MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : String(iso ?? "");
}

/** Money with two decimals becomes "$1,234.56"; ISO dates become "Sep 12". */
export function displayText(s) {
  return String(s ?? "")
    .replace(/\$\s?(-?\d[\d,]*\.\d{2})(?!\d)/g, (_, n) => fmt(toCents(n.replace(/,/g, ""))))
    .replace(/(?<![\w$.,/-])(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?![\d%])/g, (m) => fmt(toCents(m.replace(/,/g, ""))))
    .replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (_, y, mo, d) => `${SEAMS_MONTHS[Number(mo) - 1]} ${Number(d)}`);
}

/** Field labels people understand, for record tables in drawers. */
const SEAMS_PLAIN_FIELDS = {
  invoice_no: "Invoice",
  invoice: "Invoice",
  amount: "Amount",
  paid: "Paid",
  paid_date: "Paid",
  po_amount: "PO amount",
  po: "PO",
  unit_price: "Unit price",
  price: "Contract price",
  qty: "Quantity",
  sku: "SKU",
  ship_date: "Shipped",
  invoice_date: "Invoiced",
  bill_date: "Billed",
  due_date: "Due",
  freight_cost: "Freight cost",
  freight_billed: "Freight billed",
  credit_memo: "Credit memo",
  credit_memo_no: "Credit memo",
  credit_amount: "Credit",
  qty_returned: "Qty returned",
};
export function plainFieldLabel(key) {
  return SEAMS_PLAIN_FIELDS[key] || String(key).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
