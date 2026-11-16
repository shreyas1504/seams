// Column mapping: canonical fields, fuzzy header match, date normalization.

export const ENTITY_CANONICAL_FIELDS = {
  Contract: [
    "contract_id", "customer_name", "sku", "contract_price", "start_date", "end_date",
    "rebill_freight", "payment_terms_days", "billing_email",
  ],
  Shipment: [
    "shipment_id", "order_no", "ship_to", "sku", "qty", "ship_date", "ship_type", "freight_cost",
  ],
  Invoice: [
    "invoice_no", "order_ref", "customer", "sku", "qty", "unit_price", "freight_billed",
    "amount", "invoice_date", "due_date", "status", "paid_date",
  ],
  VendorBill: [
    "bill_id", "vendor", "vendor_invoice_no", "bill_date", "amount", "po_no", "po_amount",
    "payment_id", "paid_date",
  ],
  Return: [
    "return_id", "order_ref", "customer", "sku", "qty_returned", "return_date",
    "credit_memo_no", "credit_amount", "note",
  ],
};

export const ENTITY_REQUIRED_FIELDS = {
  Contract: ["contract_id", "customer_name", "sku", "contract_price", "start_date"],
  Shipment: ["shipment_id", "order_no", "ship_to", "sku", "qty", "ship_date"],
  Invoice: ["invoice_no", "customer", "sku", "qty", "unit_price", "amount", "invoice_date"],
  VendorBill: ["bill_id", "vendor", "vendor_invoice_no", "bill_date", "amount"],
  Return: ["return_id", "order_ref", "customer", "sku", "qty_returned", "return_date"],
};

export const ENTITY_DATE_FIELDS = {
  Contract: ["start_date", "end_date"],
  Shipment: ["ship_date"],
  Invoice: ["invoice_date", "due_date", "paid_date"],
  VendorBill: ["bill_date", "paid_date"],
  Return: ["return_date"],
};

const DATE_FIELD_SET = new Set(Object.values(ENTITY_DATE_FIELDS).flat());

export function normalizeHeaderToken(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(s) {
  return new Set(normalizeHeaderToken(s).split(" ").filter(Boolean));
}

/** Jaccard-ish similarity between two header strings after normalization. */
export function headerSimilarity(a, b) {
  const na = normalizeHeaderToken(a);
  const nb = normalizeHeaderToken(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const sa = tokenSet(na);
  const sb = tokenSet(nb);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  const j = union ? inter / union : 0;
  // Soft boost when tokens of the canonical field appear in the messy header.
  const canonBits = nb.replace(/_/g, " ").split(" ").filter(Boolean);
  const hit = canonBits.filter((t) => sa.has(t)).length;
  const boost = canonBits.length ? hit / canonBits.length : 0;
  return Math.max(j, boost * 0.85);
}

const ALIASES = {
  contract_id: ["contract #", "contract no", "contract number"],
  customer_name: ["account name", "customer name"],
  sku: ["item code", "item", "product", "sku"],
  contract_price: ["agreed price", "agreed price $"],
  start_date: ["effective from"],
  end_date: ["effective to"],
  rebill_freight: ["pass through freight", "pass-through freight"],
  payment_terms_days: ["net terms"],
  billing_email: ["ap contact email"],
  shipment_id: ["ship id"],
  order_no: ["sales order"],
  ship_to: ["ship to"],
  qty: ["qty shipped", "qty billed"],
  ship_date: ["ship dt"],
  ship_type: ["shipment type"],
  freight_cost: ["carrier cost"],
  invoice_no: ["inv #", "inv no"],
  order_ref: ["customer po so ref", "orig order", "customer po / so ref"],
  customer: ["bill to", "customer name"],
  unit_price: ["rate"],
  freight_billed: ["shipping charged"],
  amount: ["invoice total", "amount paid"],
  invoice_date: ["inv date"],
  due_date: ["due"],
  status: ["payment status"],
  paid_date: ["date paid", "payment dt"],
  bill_id: ["bill id"],
  vendor: ["supplier"],
  vendor_invoice_no: ["supplier inv no"],
  bill_date: ["bill dt"],
  po_no: ["po number"],
  po_amount: ["po value"],
  payment_id: ["payment ref"],
  return_id: ["rma #", "rma"],
  qty_returned: ["units back"],
  return_date: ["rma date"],
  credit_memo_no: ["credit memo"],
  credit_amount: ["credit $", "credit"],
  note: ["reason"],
};

function aliasScore(header, field) {
  const n = normalizeHeaderToken(header);
  const list = ALIASES[field] || [];
  for (const a of list) {
    if (normalizeHeaderToken(a) === n) return 1;
  }
  // Exact canonical match
  if (n === normalizeHeaderToken(field.replace(/_/g, " "))) return 1;
  if (n === field) return 1;
  return headerSimilarity(header, field.replace(/_/g, " "));
}

/** Fuzzy-map source headers onto canonical fields for an entity. */
export function fuzzyMapHeaders(headers, targetEntity) {
  const fields = ENTITY_CANONICAL_FIELDS[targetEntity] || [];
  const used = new Set();
  const scored = [];
  for (const h of headers) {
    for (const f of fields) {
      scored.push({ source_col: h, maps_to: f, confidence: aliasScore(h, f) });
    }
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  const column_map = [];
  for (const row of scored) {
    if (row.confidence < 0.45) continue;
    if (used.has(row.source_col) || used.has(row.maps_to)) continue;
    used.add(row.source_col);
    used.add(row.maps_to);
    column_map.push({ source_col: row.source_col, maps_to: row.maps_to, confidence: Number(row.confidence.toFixed(3)) });
  }
  return column_map;
}

export function guessTargetEntity(headers) {
  let best = { entity: "Invoice", score: -1 };
  for (const entity of Object.keys(ENTITY_CANONICAL_FIELDS)) {
    const map = fuzzyMapHeaders(headers, entity);
    const score = map.reduce((a, m) => a + m.confidence, 0);
    if (score > best.score) best = { entity, score };
  }
  return best.entity;
}

/** True when a date string has both parts ≤ 12 (ambiguous MM/DD vs DD/MM). */
export function dateValueAmbiguous(v) {
  const m = String(v || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a <= 12 && b <= 12 && a !== b;
}

export function anyAmbiguousDates(rows, dateSourceCols) {
  for (const col of dateSourceCols) {
    for (const r of rows.slice(0, 40)) {
      if (dateValueAmbiguous(r[col])) return true;
    }
  }
  return false;
}

/** Normalize a single date string to ISO YYYY-MM-DD. */
export function normalizeDateValue(v, dateFormat = "MDY") {
  const s = String(v || "").trim();
  if (!s) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return s;
  let a = Number(m[1]);
  let b = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  let month;
  let day;
  if (dateFormat === "DMY") {
    day = a;
    month = b;
  } else {
    month = a;
    day = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return s;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function applyColumnMap(rows, column_map, dateFormat = "MDY") {
  return rows.map((r) => {
    const out = {};
    for (const m of column_map) {
      if (!m.maps_to) continue;
      let val = r[m.source_col];
      if (DATE_FIELD_SET.has(m.maps_to)) val = normalizeDateValue(val, dateFormat);
      out[m.maps_to] = val;
    }
    return out;
  });
}

export function isDateField(field) {
  return DATE_FIELD_SET.has(field);
}
