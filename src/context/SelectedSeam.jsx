// Shared selection on Today: which seam (e.g. "AP→Vendors") and which flag (by stable_key) the user picked.
// The brief, the map, Today's fixes and the proof trace all read this.
import React, { createContext, useContext, useMemo, useState } from "react";

const SelectedSeamContext = createContext({
  selectedSeam: null,
  setSelectedSeam: () => {},
  selectedFlagKey: null,
  setSelectedFlagKey: () => {},
});

export function SelectedSeamProvider({ children }) {
  const [selectedSeam, setSelectedSeam] = useState(null);
  const [selectedFlagKey, setSelectedFlagKey] = useState(null);
  const value = useMemo(
    () => ({ selectedSeam, setSelectedSeam, selectedFlagKey, setSelectedFlagKey }),
    [selectedSeam, selectedFlagKey],
  );
  return <SelectedSeamContext.Provider value={value}>{children}</SelectedSeamContext.Provider>;
}

export function useSelectedSeam() {
  return useContext(SelectedSeamContext);
}
