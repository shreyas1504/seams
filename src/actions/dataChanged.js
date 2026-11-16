// App-wide "data changed" signal: fired after any import, check run or approval,
// so screens that show flags (Today's brief and map) refetch together.
const SEAMS_DATA_EVENT = "seams:data-changed";

export function announceSeamsDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SEAMS_DATA_EVENT));
}

/** Subscribe; returns an unsubscribe function. */
export function onSeamsDataChanged(cb) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SEAMS_DATA_EVENT, cb);
  return () => window.removeEventListener(SEAMS_DATA_EVENT, cb);
}

// Open the ⌘K palette on a record from anywhere (proof chips, letters). SeamsApp listens.
const SEAMS_LOOKUP_EVENT = "seams:lookup";
export function openSeamsLookup(query, opts = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SEAMS_LOOKUP_EVENT, { detail: { query, ask: Boolean(opts.ask) } }));
}
export function onSeamsLookup(cb) {
  if (typeof window === "undefined") return () => {};
  const h = (e) => cb(e.detail?.query || "", Boolean(e.detail?.ask));
  window.addEventListener(SEAMS_LOOKUP_EVENT, h);
  return () => window.removeEventListener(SEAMS_LOOKUP_EVENT, h);
}
