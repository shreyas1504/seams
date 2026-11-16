import React from "react";
import { useSeamsDrawerLifecycle } from "@/components/InteractionFeedback.jsx";

export default function SeamsSheet({ title, eyebrow, onClose, children, wide = false }) {
  useSeamsDrawerLifecycle(onClose);
  return <div className="seams-sheet-overlay">
    <button className="seams-sheet-backdrop" aria-label="Close sheet" onClick={onClose} />
    <section className={`seams-sheet${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="seams-sheet-header">
        <div><p className="brief-label">{eyebrow}</p><h2 className="font-display text-[24px] font-semibold">{title}</h2></div>
        <button className="sheet-close" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <div className="seams-sheet-content">{children}</div>
    </section>
  </div>;
}
