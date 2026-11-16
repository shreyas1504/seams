// Shared selection: which seam (e.g. "AP→Vendors") the user picked from the brief.
// Later parts (Where it slipped, Today's fixes, Proof trace) read this.
import React, { createContext, useContext, useMemo, useState } from "react";

const SelectedSeamContext = createContext({ selectedSeam: null, setSelectedSeam: () => {} });

export function SelectedSeamProvider({ children }) {
  const [selectedSeam, setSelectedSeam] = useState(null);
  const value = useMemo(() => ({ selectedSeam, setSelectedSeam }), [selectedSeam]);
  return <SelectedSeamContext.Provider value={value}>{children}</SelectedSeamContext.Provider>;
}

export function useSelectedSeam() {
  return useContext(SelectedSeamContext);
}
