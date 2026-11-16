// npm run transfer  ->  builds ./transfer/, the paste-ready pack for Base44.
// 1) functions: inline the engine, swap the local SDK shim import for the real one ("npm:@base44/sdk")
// 2) entities: copy base44/entities/*.json (minus local-only Outbox)
// 3) frontend: copy src/ files that move as-is; list the ones that must NOT move (local stand-ins)
// 4) seed CSVs + checklist
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url).pathname;
const out = `${root}transfer/`;
rmSync(out, { recursive: true, force: true });
for (const d of ["functions", "entities", "frontend", "seed"]) mkdirSync(`${out}${d}`, { recursive: true });

const engine = readFileSync(`${root}src/lib/engine/engine.js`, "utf8");
const SDK_LOCAL = /^import \{ createClientFromRequest \} from "\.\.\/src\/lib\/local\/sdkShim\.js";.*$/m;
const ENGINE_LOCAL = /^import \{[^}]*\} from "\.\.\/src\/lib\/engine\/engine\.js";.*$/m;
let n = 0;
for (const f of readdirSync(`${root}functions`).filter((f) => f.endsWith(".js"))) {
  let src = readFileSync(`${root}functions/${f}`, "utf8");
  if (!SDK_LOCAL.test(src)) throw new Error(`${f}: missing local SDK import line`);
  src = src.replace(SDK_LOCAL, 'import { createClientFromRequest } from "npm:@base44/sdk";');
  if (ENGINE_LOCAL.test(src)) src = src.replace(ENGINE_LOCAL, `// ENGINE START (generated from src/lib/engine/engine.js — do not edit here)\n${engine}\n// ENGINE END`);
  writeFileSync(`${out}functions/${f.replace(/\.js$/, ".ts")}`, src); n++;
}
for (const f of readdirSync(`${root}base44/entities`)) if (f !== "Outbox.json") cpSync(`${root}base44/entities/${f}`, `${out}entities/${f}`);
const KEEP_LOCAL = ["src/lib/local", "src/api/base44Client.js"];
cpSync(`${root}src`, `${out}frontend/src`, { recursive: true, filter: (p) => !KEEP_LOCAL.some((k) => p.startsWith(`${root}${k}`)) });
writeFileSync(`${out}engine.bundle.js`, engine);
if (existsSync(`${root}public/seed`)) cpSync(`${root}public/seed`, `${out}seed`, { recursive: true });
writeFileSync(`${out}README.txt`,
`Paste-ready pack for Base44. Follow BASE44_TRANSFER.md step by step.
functions/*.ts  -> one Base44 backend function each (name = file name). Engine already inlined. SDK import already real.
entities/*.json -> one Base44 entity each (name = file name). Includes rls.
frontend/src    -> pages, components, engine, csv parser. Do NOT copy src/lib/local or src/api/base44Client.js (Base44 has its own client at the same path).
engine.bundle.js -> the engine alone (for Path C: run it in the frontend).
seed/*.csv      -> mock data for the golden-number check before switching to the real data.
`);
console.log(`transfer/ built: ${n} functions, entities, frontend, engine bundle`);

// ---------- COMPACT PACK (fewer pastes tomorrow) ----------
// transfer/compact/ENTITIES_PROMPT.md : one prompt that creates all entities
// transfer/compact/FUNCTIONS.md       : every backend function, in creation order
// transfer/compact/SeamsAll.jsx       : the whole frontend (engine, csv, hooks, components, pages) in ONE file
{
  const C = `${out}compact/`; mkdirSync(C, { recursive: true });
  const ents = readdirSync(`${out}entities`).sort();
  writeFileSync(`${C}ENTITIES_PROMPT.md`,
    `Create these ${ents.length} entities exactly as specified (names are case-sensitive; keep every field, type, enum and the rls block; do not add or rename fields):\n\n` +
    ents.map((f) => `### ${f.replace(".json", "")}\n\`\`\`json\n${readFileSync(`${out}entities/${f}`, "utf8")}\n\`\`\``).join("\n\n"));
  const order = ["runChecks", "importRows", "resetDemo"];
  const fns = readdirSync(`${out}functions`).map((f) => f.replace(".ts", "")).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  writeFileSync(`${C}FUNCTIONS.md`, fns.map((n) => `## Backend function: ${n}\n\`\`\`ts\n${readFileSync(`${out}functions/${n}.ts`, "utf8")}\n\`\`\``).join("\n\n"));

  // bundle frontend: lib files first, then components, then pages; strip local imports; one React import
  const fe = `${out}frontend/src/`;
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}${e.name}/`) : [`${d}${e.name}`]));
  const files = walk(fe).filter((p) => /\.(jsx?|mjs)$/.test(p) && !/\/(main|App)\.jsx$/.test(p));
  const rank = (p) => (p.includes("/lib/") ? 0 : p.includes("/components/") ? 1 : 2);
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  // Order files so every file comes AFTER the files it imports. In one big file, a top-level
  // `const X = [{ color: SYSTEM_TINT.CRM }]` crashes ("Cannot access before initialization")
  // if SYSTEM_TINT is defined further down, so alphabetical order is not enough.
  {
    const set = new Set(files);
    const resolve = (from, spec) => {
      const base = spec.startsWith("@/") ? `${fe}${spec.slice(2)}` : new URL(spec, `file://${from}`).pathname;
      for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`]) if (set.has(c)) return c;
      return null;
    };
    const deps = new Map(files.map((f) => [f, [...readFileSync(f, "utf8").matchAll(/^import\s+[^;]*?from\s+"((?:@\/|\.\.?\/)[^"]*)";/gm)].map((m) => resolve(f, m[1])).filter(Boolean)]));
    const ordered = [], state = new Map();
    const visit = (f) => {
      if (state.get(f) === 2) return;
      if (state.get(f) === 1) return; // import cycle: keep current order
      state.set(f, 1);
      for (const d of deps.get(f) || []) visit(d);
      state.set(f, 2);
      ordered.push(f);
    };
    files.forEach(visit);
    files.splice(0, files.length, ...ordered);
  }
  const reactNames = new Set(), seen = new Map(), dups = [];
  let body = "";
  for (const p of files) {
    let src = readFileSync(p, "utf8");
    src = src.replace(/^import\s+React\s*,?\s*\{([^}]*)\}\s+from\s+"react";\s*$/gm, (_, n) => { n.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => reactNames.add(x)); return ""; });
    src = src.replace(/^import\s+React\s+from\s+"react";\s*$/gm, "");
    src = src.replace(/^import\s+\{([^}]*)\}\s+from\s+"react";\s*$/gm, (_, n) => { n.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => reactNames.add(x)); return ""; });
    src = src.replace(/^import\s+[^;]*from\s+"(@\/|\.\.?\/)[^"]*";.*$/gm, "");   // local imports become same-file references
    src = src.replace(/^export default function (\w+)/m, "export function $1");
    for (const m of src.matchAll(/^(?:export\s+)?(?:const|let|function|class)\s+(\w+)/gm)) {
      if (seen.has(m[1])) dups.push(`${m[1]} (${seen.get(m[1])} and ${p.replace(fe, "")})`); else seen.set(m[1], p.replace(fe, ""));
    }
    body += `\n// ===== ${p.replace(fe, "src/")} =====\n${src}`;
  }
  if (dups.length) { console.error("COMPACT BUNDLE: duplicate top-level names — rename one of each:\n  " + dups.join("\n  ")); process.exit(1); }
  const header = `// SeamsAll.jsx — generated by npm run transfer. Paste as ONE file in Base44 (e.g. src/pages/SeamsAll.jsx),\n// then route "/" -> SeamsApp (also the default export). SeamsApp is the whole app with its own styles.\nimport React, { ${[...reactNames].join(", ")} } from "react";\nimport { base44 } from "@/api/base44Client";\n`;
  // Base44's router imports a page file's default export: make the whole app the default.
  const footer = seen.has("SeamsApp") ? "\nexport default SeamsApp;\n" : "";
  writeFileSync(`${C}SeamsAll.jsx`, header + body + footer);
  console.log(`compact/: ENTITIES_PROMPT.md (${ents.length}), FUNCTIONS.md (${fns.length}), SeamsAll.jsx (${files.length} files)`);
}
