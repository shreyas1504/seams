// LOCAL STAND-IN for the Base44 SDK client. Same surface as @base44/sdk so app code doesn't change tomorrow:
//   base44.entities.X.list(sort?, limit?, skip?) / filter(query, sort?, limit?, skip?) / get(id) / create(data)
//   / bulkCreate(arr) / update(id, data) / delete(id) / subscribe(cb)
//   base44.functions.invoke(name, data) -> { data }      (AxiosResponse-like)
//   base44.integrations.Core.InvokeLLM({prompt, response_json_schema}) / SendEmail({to, subject, body})
//   base44.auth.me()  base44.asServiceRole (same object locally)
// Storage: localStorage in the browser, in-memory in Node tests.
const mem = new Map();
const store = {
  get: (k) => (globalThis.localStorage ? globalThis.localStorage.getItem(k) : mem.get(k) ?? null),
  set: (k, v) => (globalThis.localStorage ? globalThis.localStorage.setItem(k, v) : mem.set(k, v)),
};
const listeners = new Map();
const read = (name) => JSON.parse(store.get(`seams:${name}`) || "[]");
const write = (name, rows) => { store.set(`seams:${name}`, JSON.stringify(rows)); (listeners.get(name) || []).forEach((cb) => cb({ type: "change" })); };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const match = (row, q) => Object.entries(q || {}).every(([k, v]) =>
  Array.isArray(v) ? v.includes(row[k]) : v && typeof v === "object" && "$in" in v ? v.$in.includes(row[k]) : row[k] === v);
const sortRows = (rows, sort) => {
  if (!sort) return rows;
  const desc = sort.startsWith("-"), k = sort.replace(/^-/, "");
  return [...rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (desc ? -1 : 1));
};
const page = (rows, limit = 5000, skip = 0) => rows.slice(skip, skip + limit);

function entity(name) {
  return {
    list: async (sort, limit, skip) => page(sortRows(read(name), sort), limit, skip),
    filter: async (q, sort, limit, skip) => page(sortRows(read(name).filter((r) => match(r, q)), sort), limit, skip),
    get: async (id) => read(name).find((r) => r.id === id) ?? null,
    create: async (data) => { const row = { id: uid(), created_date: new Date().toISOString(), ...data }; write(name, [...read(name), row]); return row; },
    bulkCreate: async (arr) => { const rows = arr.map((d) => ({ id: uid(), created_date: new Date().toISOString(), ...d })); write(name, [...read(name), ...rows]); return rows; },
    update: async (id, data) => { let out; write(name, read(name).map((r) => (r.id === id ? (out = { ...r, ...data, updated_date: new Date().toISOString() }) : r))); return out; },
    delete: async (id) => { write(name, read(name).filter((r) => r.id !== id)); return { id }; },
    subscribe: (cb) => { const l = listeners.get(name) || []; listeners.set(name, [...l, cb]); return () => listeners.set(name, (listeners.get(name) || []).filter((x) => x !== cb)); },
  };
}
const entities = new Proxy({}, { get: (_, name) => entity(String(name)) });

// Simulated signed-in user; the role switcher in the UI sets this.
export function setLocalUser(user) { store.set("seams:__user", JSON.stringify(user)); }
const auth = { me: async () => JSON.parse(store.get("seams:__user") || '{"email":"dana@northline.example","full_name":"Dana","role":"admin"}') };

// LLM stub: returns null so callers use their deterministic template fallback (the same path used if InvokeLLM fails).
// To test with a real model tonight, implement this with your own API key; tomorrow it is Base44 InvokeLLM.
const integrations = { Core: {
  InvokeLLM: async (_params) => { throw new Error("LLM_OFFLINE"); },
  SendEmail: async ({ to, subject, body, from_name }) => entities.Outbox.create({ to, subject, body, from_name: from_name || "Northline Supply", sent_at: new Date().toISOString() }),
} };

const fnModules = import.meta.glob ? import.meta.glob("/functions/*.js") : null; // Vite
const functions = {
  invoke: async (name, data = {}) => {
    const load = fnModules ? fnModules[`/functions/${name}.js`] : () => import(`../../../functions/${name}.js`);
    if (!load) throw new Error(`Unknown function ${name}`);
    const handler = (await load()).default;
    const req = new Request("http://local/fn/" + name, { method: "POST", body: JSON.stringify(data), headers: { "content-type": "application/json" } });
    const res = await handler(req);
    const body = await res.json();
    if (!res.ok) { const e = new Error(body?.error || `HTTP ${res.status}`); e.response = { status: res.status, data: body }; throw e; }
    return { data: body, status: res.status };
  },
};

export const localBase44 = { entities, auth, integrations, functions };
localBase44.asServiceRole = localBase44;
