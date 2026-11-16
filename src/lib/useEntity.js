import { useEffect, useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { onSeamsDataChanged } from "@/actions/dataChanged.js";

/**
 * Live list of an entity: same code works with the local stand-in and the real Base44 SDK (list + subscribe).
 * Returns [rows, reload, { loaded, error }]. `loaded` stays false until the first list returns, so screens can
 * tell "still loading" apart from "nothing there". Every list also refetches on the app-wide data-changed event
 * (import, approve, revoke, reset), so no screen keeps stale contracts, invoices, returns or settings.
 */
export function useEntity(name) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ loaded: false, error: null });
  const seq = useRef(0); // only the newest response may land, so an old list never overwrites a newer one
  const reload = useCallback(() => {
    const mine = ++seq.current;
    return base44.entities[name]
      .list(undefined, 5000)
      .then((r) => {
        if (mine !== seq.current) return;
        setRows(r || []);
        setMeta({ loaded: true, error: null });
      })
      .catch((e) => {
        if (mine !== seq.current) return;
        setMeta({ loaded: true, error: e?.message || "Could not load " + name });
      });
  }, [name]);
  useEffect(() => {
    reload();
    const un = base44.entities[name].subscribe?.(() => reload());
    const off = onSeamsDataChanged(() => reload());
    return () => {
      if (typeof un === "function") un();
      off();
    };
  }, [name, reload]);
  return [rows, reload, meta];
}
