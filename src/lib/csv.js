// Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas/newlines in quotes). No dependencies.
export function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = ""; if (row.some((v) => v !== "")) rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  const [header, ...body] = rows;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, j) => [h.trim(), (r[j] ?? "").trim()]))) };
}
/** Stable hash of a header row (mapping key, v3): lowercase, trimmed, joined with | */
export function headerHash(header) {
  const s = header.map((h) => h.trim().toLowerCase()).join("|");
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
