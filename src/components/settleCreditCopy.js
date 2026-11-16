import { digits, fmt, toCents } from "@/lib/engine/engine.js";

// Shorten a return-credit line only when the source records reproduce its exact cents.
export function settleCreditCopy(line, returns, invoices) {
  if (line.flag?.rule_id !== "missing_credit") return line.text;
  const returnId = line.evidence?.find((e) => e.system === "Returns")?.id;
  const returned = returns.find((r) => r.return_id === returnId);
  if (!returned || returned.credit_memo_no || toCents(returned.credit_amount)) return line.text;
  const billed = invoices.filter((i) => digits(i.order_ref) === digits(returned.order_ref) && i.sku === returned.sku);
  const prices = [...new Set(billed.map((i) => toCents(i.unit_price)))];
  const qty = Number(returned.qty_returned);
  if (prices.length !== 1 || !Number.isInteger(qty) || qty <= 0 || qty * prices[0] !== line.amount_cents) return line.text;
  return `Return ${returnId}, ${qty} × ${fmt(prices[0])}, credit never issued`;
}
