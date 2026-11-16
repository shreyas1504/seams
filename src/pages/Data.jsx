// Existing code-based CSV mapping/import pipeline, presented as a three-step upload.
import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { parseCsv, headerHash } from "@/lib/csv.js";
import { ENTITY_CANONICAL_FIELDS, ENTITY_REQUIRED_FIELDS, ENTITY_DATE_FIELDS, fuzzyMapHeaders, applyColumnMap, anyAmbiguousDates, isDateField } from "@/lib/mapping.js";
import { loadDemoData } from "@/actions/loadDemoData.js";
import { useEntity } from "@/lib/useEntity";
import TwistCard from "@/components/TwistCard.jsx";
import { fmt, toCents } from "@/lib/engine/engine.js";

const DATA_ENTITY_OPTIONS = Object.keys(ENTITY_CANONICAL_FIELDS);
const dataErrorMessage = (e) => e?.response?.data?.error || e.message;
const DATA_MONEY_FIELDS = new Set(["credit_amount","amount","contract_price","unit_price","freight_cost","freight_billed","po_amount"]);

function dataPreviewValue(field, value) {
  return DATA_MONEY_FIELDS.has(field) && value !== "" && value != null ? fmt(toCents(value)) : String(value ?? "—");
}

export default function Data({ role = "admin", onApproved }) {
  const [log, setLog] = useState([]);
  const [entity, setEntity] = useState("Contract");
  const [parsed, setParsed] = useState(null);
  const [columnMap, setColumnMap] = useState([]);
  const [dateFormat, setDateFormat] = useState("MDY");
  const [needDateChoice, setNeedDateChoice] = useState(false);
  const [mappingNote, setMappingNote] = useState("");
  const [joinHealth, setJoinHealth] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState(null);
  const [returns] = useEntity("Return");
  const [settings] = useEntity("Setting");
  const pipelineLock = useRef(false);
  const controllerOnly = role !== "admin";
  const say = (m) => setLog((l) => [...l, m]);
  const fields = ENTITY_CANONICAL_FIELDS[entity] || [];
  const required = new Set(ENTITY_REQUIRED_FIELDS[entity] || []);
  const preview = useMemo(() => {
    if (!parsed) return { rows: [], error: "" };
    try { return { rows: applyColumnMap(parsed.rows.slice(0,5), columnMap, dateFormat), error: "" }; }
    catch (e) { return { rows: [], error: dataErrorMessage(e) }; }
  }, [parsed, columnMap, dateFormat]);
  const missing = [...required].filter((f) => !columnMap.some((m) => m.maps_to === f));
  const source = /AI|LLM/i.test(mappingNote) ? "AI" : "fuzzy";
  const ruleApproved = Boolean(settings[0]?.rule_enabled?.return_offset && settings[0]?.rule_enabled?.dup_credit_memo && settings[0]?.rule_enabled?.missing_credit);

  function setMapForSource(source_col, maps_to) {
    setImported(null);
    setColumnMap((prev) => {
      const next = prev.filter((m) => m.source_col !== source_col && m.maps_to !== maps_to);
      if (maps_to) next.push({ source_col, maps_to, confidence: 1 });
      return next;
    });
  }
  async function resetDemo() {
    if (controllerOnly || pipelineLock.current) return;
    pipelineLock.current = true; setBusy(true); setError(""); setLog([]); setJoinHealth([]); setParsed(null); setImported(null);
    try { const checks = await loadDemoData(say); setJoinHealth(checks.needs_review || []); }
    catch (e) { setError(dataErrorMessage(e)); }
    finally { pipelineLock.current=false;setBusy(false); }
  }
  async function onChooseFile(e) {
    const file = e.target.files?.[0];
    if (!file || pipelineLock.current) return;
    pipelineLock.current=true;setBusy(true);setLog([]);setError("");setImported(null);setParsed(null);
    try {
      const { header, rows } = parseCsv(await file.text());
      if (!header.length || !rows.length) throw new Error("No data rows found. Check the file's column headers.");
      const hash = headerHash(header);
      setParsed({header,rows,hash,file_name:file.name});
      say(`Parsed ${rows.length} rows from ${file.name}`);
      const saved = await base44.entities.ColumnMapping.filter({header_hash:hash});
      if (saved[0]) {
        setEntity(saved[0].target_entity);setColumnMap(saved[0].column_map||[]);
        setDateFormat(saved[0].date_format||"MDY");setMappingNote("Saved mapping reused");setNeedDateChoice(false);
      } else {
        let target=entity;
        let map=fuzzyMapHeaders(header,target);
        let note="Fuzzy header match (prefill)";
        try {
          const sug=await base44.functions.invoke("suggestMapping",{headers:header,sample_rows:rows.slice(0,5)});
          if(sug.data?.target_entity){target=sug.data.target_entity;map=sug.data.column_map?.length?sug.data.column_map:fuzzyMapHeaders(header,target);note=`Suggested by ${sug.data.source||"fuzzy"}`;}
        } catch { map=fuzzyMapHeaders(header,target); }
        setEntity(target);setColumnMap(map);setMappingNote(note);
        const dateCols=map.filter((m)=>isDateField(m.maps_to)).map((m)=>m.source_col);
        const ambiguous=anyAmbiguousDates(rows,dateCols);
        setNeedDateChoice(ambiguous);if(!ambiguous)setDateFormat("MDY");
      }
    } catch(err){setError(dataErrorMessage(err));}
    finally{pipelineLock.current=false;setBusy(false);e.target.value="";}
  }
  async function confirmImport() {
    if(!parsed||controllerOnly||pipelineLock.current)return;
    if(missing.length){setError(`Missing required column: ${missing.join(", ")}`);return;}
    if(needDateChoice){setError("Choose MM/DD or DD/MM for the date columns.");return;}
    pipelineLock.current=true;setBusy(true);setError("");
    try{
      await base44.functions.invoke("saveMapping",{header_hash:parsed.hash,target_entity:entity,column_map:columnMap,date_format:dateFormat});
      const rows=applyColumnMap(parsed.rows,columnMap,dateFormat);
      const result=await base44.functions.invoke("importRows",{entity,rows,header_hash:parsed.hash,file_name:parsed.file_name});
      say(`rows parsed ${parsed.rows.length} · imported ${result.data.imported}`);
      const checks=await base44.functions.invoke("runChecks");
      announceSeamsDataChanged();
      say(`runChecks: +${checks.data.counts.new} new · ${checks.data.counts.cleared} cleared · ${checks.data.counts.needs_review} needs review`);
      setJoinHealth(checks.data.needs_review||[]);setMappingNote("Saved mapping reused");setImported(result.data.imported);
    }catch(e){setError(dataErrorMessage(e));}
    finally{pipelineLock.current=false;setBusy(false);}
  }
  const showTwist = parsed ? entity==="Return" && imported!=null : returns.length>0;
  const mappedFields = [...new Set(preview.rows.flatMap((r)=>Object.keys(r)))];
  const returnFirst = ["return_id","customer","sku","qty_returned","credit_amount"];
  const shownFields = entity==="Return" ? [...returnFirst.filter(f=>mappedFields.includes(f)),...mappedFields.filter(f=>!returnFirst.includes(f))] : mappedFields;
  return <div className="upload-workspace">
    <div className="upload-file-heading"><div><p className="brief-label">Upload new data</p><h1 className="font-display text-[22px] mt-1">{parsed?.file_name || "Connect the next file"}</h1></div><p className="text-xs text-muted">{parsed ? `rows in file ${parsed.rows.length} · imported ${imported??0}` : "CSV · parsed in code"}</p></div>
    <ol className="upload-steps" aria-label="Import steps">{["Read file","Match columns","Preview the change"].map((s,i)=><li key={s} className={(i===0&&parsed)||(i===1&&imported!=null)||(i===2&&(ruleApproved||(imported!=null&&entity!=="Return")))?"is-complete":""}><span>{i+1}</span> {s}{((i===0&&parsed)||(i===1&&imported!=null)||(i===2&&(ruleApproved||(imported!=null&&entity!=="Return"))))?" ✓":""}</li>)}</ol>
    <div className="flex flex-wrap gap-2">
      <label className={`btn-forest ${busy?"opacity-50":""}`}>Choose a file<input aria-label="Choose CSV file" type="file" accept=".csv" className="sr-only" onChange={onChooseFile} disabled={busy} /></label>
      <button className="seam-chip" onClick={resetDemo} disabled={busy||controllerOnly}>{busy?"Working…":"Reset demo"}</button>
    </div>
    {controllerOnly ? <p className="text-xs text-muted mt-2">Controller approval needed to import or reset data</p> : null}
    {error || preview.error ? <p className="upload-error" role="alert">{error||preview.error}</p> : null}
    {parsed ? <>
      <section className="mt-5">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-[13px] font-medium">Columns matched</h2><span className="chip chip-neutral">{source}</span><span className="text-xs text-muted">{mappingNote}</span></div>
        <label className="block text-xs text-muted mt-3">Recognised as <select aria-label="Target entity" disabled={busy} value={entity} onChange={(e)=>{setEntity(e.target.value);setColumnMap(fuzzyMapHeaders(parsed.header,e.target.value));setImported(null);}}>{DATA_ENTITY_OPTIONS.map((o)=><option key={o}>{o}</option>)}</select></label>
        <div className="upload-mappings mt-3">{parsed.header.map(h=><label key={h}><span>{h} →</span><select aria-label={`Map ${h}`} value={columnMap.find(m=>m.source_col===h)?.maps_to||""} disabled={busy} onChange={e=>setMapForSource(h,e.target.value)}><option value="">Skip</option>{fields.map(f=><option key={f} value={f}>{f}{required.has(f)?" *":""}</option>)}</select></label>)}</div>
        <p className="text-[11px] text-muted mt-2">Required fields marked *. Date columns: {(ENTITY_DATE_FIELDS[entity]||[]).join(", ")||"none"}.</p>
        {needDateChoice ? <div className="card p-3 mt-3"><p className="text-xs mb-2">Choose the date format for ambiguous dates.</p><button className="seam-chip mr-2" onClick={()=>{setDateFormat("MDY");setNeedDateChoice(false);}}>MM/DD</button><button className="seam-chip" onClick={()=>{setDateFormat("DMY");setNeedDateChoice(false);}}>DD/MM</button></div> : <p className="text-xs text-muted mt-2">Date format: {dateFormat==="DMY"?"DD/MM":"MM/DD"} → ISO</p>}
      </section>
      <section className="mt-5"><h2 className="text-xs text-muted mb-2">First rows · {entity}</h2><div className="upload-table-wrap"><table className="upload-table"><thead><tr>{shownFields.map(f=><th key={f}>{f.replace(/_/g," ")}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr key={i}>{shownFields.map(f=><td key={f}>{dataPreviewValue(f,r[f])}</td>)}</tr>)}</tbody></table></div></section>
      {imported==null ? <div className="mt-4"><button className="btn-forest" disabled={busy||needDateChoice||controllerOnly} onClick={confirmImport}>{busy?<><span className="seams-spinner"/> Importing…</>:"Confirm import"}</button>{needDateChoice?<p className="text-xs text-muted mt-2">Choose a date format before importing</p>:null}</div> : <p className="text-xs text-credit mt-3">Imported {imported} rows. Checks updated.</p>}
    </> : <p className="text-sm text-muted my-6">Choose a CSV to match its columns and preview the changes. Your existing systems stay in place.</p>}
    {showTwist ? <TwistCard key={`${parsed?.hash||"existing"}-${imported??returns.length}`} fileName={parsed?.file_name||"twist_returns_log.csv"} rowsParsed={parsed?.rows.length||returns.length} rowsImported={imported??returns.length} role={role} approved={ruleApproved} onDone={(data,mode)=>{if(mode==="approve")onApproved?.(data);}}/> : null}
    {joinHealth.length ? <section className="card p-3 mt-4"><h2 className="text-sm font-semibold">Join health</h2>{joinHealth.map((n,i)=><p className="text-xs text-muted" key={i}>{typeof n==="string"?n:`${n.type}: ${n.id||n.name||"check the source column"}`}</p>)}</section> : null}
    <div className="upload-log" role="log">{log.map((m,i)=><p key={i}>{m}</p>)}</div>
  </div>;
}
