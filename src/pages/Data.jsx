// Data page: parse in code → map columns → ISO dates → saveMapping → importRows → runChecks.
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { parseCsv, headerHash } from "@/lib/csv.js";
import {
  ENTITY_CANONICAL_FIELDS,
  ENTITY_REQUIRED_FIELDS,
  ENTITY_DATE_FIELDS,
  fuzzyMapHeaders,
  applyColumnMap,
  anyAmbiguousDates,
  isDateField,
} from "@/lib/mapping.js";
import { loadDemoData } from "@/actions/loadDemoData.js";

const ENTITY_OPTIONS = Object.keys(ENTITY_CANONICAL_FIELDS);
const errMsg = (e) => e?.response?.data?.error || e.message;

export default function Data({ role = "admin" }) {
  const [log, setLog] = useState([]);
  const [entity, setEntity] = useState("Contract");
  const [parsed, setParsed] = useState(null);
  const [columnMap, setColumnMap] = useState([]);
  const [dateFormat, setDateFormat] = useState("MDY");
  const [needDateChoice, setNeedDateChoice] = useState(false);
  const [mappingNote, setMappingNote] = useState("");
  const [joinHealth, setJoinHealth] = useState([]);
  const [busy, setBusy] = useState(false);

  const controllerOnly = role !== "admin";
  const say = (m) => setLog((l) => [...l, m]);
  const fields = ENTITY_CANONICAL_FIELDS[entity] || [];
  const required = new Set(ENTITY_REQUIRED_FIELDS[entity] || []);

  const mappedPreview = useMemo(() => {
    if (!parsed) return [];
    return applyColumnMap(parsed.rows.slice(0, 3), columnMap, dateFormat);
  }, [parsed, columnMap, dateFormat]);

  function setMapForSource(source_col, maps_to) {
    setColumnMap((prev) => {
      const next = prev.filter((m) => m.source_col !== source_col && m.maps_to !== maps_to);
      if (maps_to) next.push({ source_col, maps_to, confidence: 1 });
      return next;
    });
  }

  async function resetDemo() {
    if (controllerOnly) {
      say("Controller only");
      return;
    }
    setLog([]);
    setJoinHealth([]);
    setParsed(null);
    try {
      const checks = await loadDemoData(say);
      setJoinHealth(checks.needs_review || []);
    } catch (e) {
      say(`Error: ${errMsg(e)}`);
    }
  }

  async function onChooseFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLog([]);
    try {
      const text = await file.text();
      const { header, rows } = parseCsv(text);
      const hash = headerHash(header);
      setParsed({ header, rows, hash, file_name: file.name });
      say(`Parsed ${rows.length} rows from ${file.name}`);

      const saved = await base44.entities.ColumnMapping.filter({ header_hash: hash });
      if (saved[0]) {
        setEntity(saved[0].target_entity);
        setColumnMap(saved[0].column_map || []);
        setDateFormat(saved[0].date_format || "MDY");
        setMappingNote("Saved mapping reused");
        setNeedDateChoice(false);
      } else {
        let target = entity;
        let map = fuzzyMapHeaders(header, target);
        let note = "Fuzzy header match (prefill)";
        try {
          const sug = await base44.functions.invoke("suggestMapping", {
            headers: header,
            sample_rows: rows.slice(0, 5),
          });
          if (sug.data?.target_entity) {
            target = sug.data.target_entity;
            map = sug.data.column_map?.length ? sug.data.column_map : fuzzyMapHeaders(header, target);
            note = `Suggested by ${sug.data.source || "fuzzy"}`;
          }
        } catch (_) {
          map = fuzzyMapHeaders(header, target);
        }
        setEntity(target);
        setColumnMap(map);
        setMappingNote(note);
        const dateCols = map.filter((m) => isDateField(m.maps_to)).map((m) => m.source_col);
        const amb = anyAmbiguousDates(rows, dateCols);
        setNeedDateChoice(amb);
        if (!amb) setDateFormat("MDY");
      }
    } catch (err) {
      say(`Error: ${errMsg(err)}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function confirmImport() {
    if (!parsed) return;
    if (controllerOnly) {
      say("Controller only");
      return;
    }
    setBusy(true);
    try {
      const missing = (ENTITY_REQUIRED_FIELDS[entity] || []).filter(
        (f) => !columnMap.some((m) => m.maps_to === f),
      );
      if (missing.length) {
        say(`Missing required fields: ${missing.join(", ")}`);
        setBusy(false);
        return;
      }
      await base44.functions.invoke("saveMapping", {
        header_hash: parsed.hash,
        target_entity: entity,
        column_map: columnMap,
        date_format: dateFormat,
      });
      const rows = applyColumnMap(parsed.rows, columnMap, dateFormat);
      const r = await base44.functions.invoke("importRows", {
        entity,
        rows,
        header_hash: parsed.hash,
        file_name: parsed.file_name,
      });
      say(`rows parsed ${parsed.rows.length} · imported ${r.data.imported}`);
      const c = await base44.functions.invoke("runChecks");
      announceSeamsDataChanged();
      say(
        `runChecks: +${c.data.counts.new} new · ${c.data.counts.cleared} cleared · ${c.data.counts.needs_review} needs review · recoverable ${c.data.totals.recoverable.n} (${c.data.totals.recoverable.cents}¢)`,
      );
      setJoinHealth(c.data.needs_review || []);
      setMappingNote("Saved mapping reused");
    } catch (e) {
      say(`Error: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="crm-card p-5">
        <h1 className="text-[28px] font-bold tracking-tight text-[#111]">Data</h1>
        <p className="mt-1 text-sm text-[#6B6B76]">Parse in code, map columns, normalize dates, then run checks.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDemo}
            disabled={controllerOnly}
            title={controllerOnly ? "Controller only" : undefined}
            className="crm-btn-black disabled:opacity-40"
          >
            Reset demo
          </button>
          <label className="crm-btn-lime cursor-pointer">
            Choose a file
            <input type="file" accept=".csv" className="hidden" onChange={onChooseFile} disabled={busy} />
          </label>
        </div>
        {controllerOnly ? <p className="mt-2 text-xs font-semibold text-[#8A4B12]">Controller only</p> : null}
      </div>

      {parsed ? (
        <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Mapping</h2>
            {mappingNote ? (
              <span className="rounded-full bg-[#E8EEFF] px-3 py-1 text-xs text-[#3B5BDB]">{mappingNote}</span>
            ) : null}
          </div>
          <label className="mt-3 block text-sm">
            Target entity
            <select
              value={entity}
              onChange={(e) => {
                const ent = e.target.value;
                setEntity(ent);
                if (parsed) setColumnMap(fuzzyMapHeaders(parsed.header, ent));
              }}
              className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-[#F5F5F5] px-3"
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          {needDateChoice ? (
            <div className="mt-3 rounded-2xl bg-[#E8EEFF] p-3 text-sm text-[#14171F]">
              Some dates look ambiguous (both parts ≤ 12). MM/DD or DD/MM?
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDateFormat("MDY");
                    setNeedDateChoice(false);
                  }}
                  className="min-h-[44px] rounded-2xl bg-[#000000] px-4 text-white"
                >
                  MM/DD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFormat("DMY");
                    setNeedDateChoice(false);
                  }}
                  className="min-h-[44px] rounded-2xl border border-[#3B5BDB] px-4 text-[#3B5BDB]"
                >
                  DD/MM
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#5B5F68]">Date format: {dateFormat === "DMY" ? "DD/MM" : "MM/DD"} → ISO</p>
          )}

          <div className="mt-4 space-y-2">
            {parsed.header.map((h) => {
              const current = columnMap.find((m) => m.source_col === h)?.maps_to || "";
              return (
                <div key={h} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#F5F5F5] px-3 py-2 font-mono text-xs">{h}</div>
                  <select
                    value={current}
                    onChange={(e) => setMapForSource(h, e.target.value)}
                    className="min-h-[44px] rounded-2xl border border-[#E2DDD2] px-3 text-sm"
                  >
                    <option value="">— skip —</option>
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                        {required.has(f) ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-[#5B5F68]">
            Required marked with *. Date fields: {(ENTITY_DATE_FIELDS[entity] || []).join(", ")}.
          </p>

          {mappedPreview.length ? (
            <pre className="mt-3 overflow-auto rounded-2xl bg-[#F5F5F5] p-3 font-mono text-[11px]">
              {JSON.stringify(mappedPreview, null, 2)}
            </pre>
          ) : null}

          <button
            type="button"
            disabled={busy || needDateChoice || controllerOnly}
            title={controllerOnly ? "Controller only" : undefined}
            onClick={confirmImport}
            className="mt-4 min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Confirm import
          </button>
        </div>
      ) : (
        <div className="rounded-[28px] bg-white p-5 text-sm text-[#5B5F68] shadow-[0_8px_24px_rgba(0,0,0,0.04)]" role="status">
          No file loaded. Choose a CSV or Reset demo to seed the clean dataset.
        </div>
      )}

      {joinHealth.length ? (
        <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold">Join health</h2>
          <ul className="mt-2 space-y-1 text-xs text-[#5B5F68]">
            {joinHealth.map((n, i) => (
              <li key={i} className="font-mono">
                {typeof n === "string" ? n : JSON.stringify(n)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <pre className="whitespace-pre-wrap rounded-[28px] bg-white p-4 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.04)]" role="log">
        {log.join("\n") || "Log appears here."}
      </pre>
    </div>
  );
}
