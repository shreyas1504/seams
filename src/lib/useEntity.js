import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
/** Live list of an entity: same code works with the local stand-in and the real Base44 SDK (list + subscribe). */
export function useEntity(name) {
  const [rows, setRows] = useState([]);
  const reload = useCallback(() => base44.entities[name].list(undefined, 5000).then(setRows), [name]);
  useEffect(() => { reload(); const un = base44.entities[name].subscribe?.(() => reload()); return () => un && un(); }, [name, reload]);
  return [rows, reload];
}
