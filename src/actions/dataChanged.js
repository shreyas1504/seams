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
