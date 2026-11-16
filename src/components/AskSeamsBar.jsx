// "Ask Seams" on Today: a visible way into the assistant. Submitting opens the ⌘K panel with the answer,
// record chips and (for "fix ...") a draft that still needs a Controller's approval.
import React, { useState } from "react";
import { openSeamsLookup } from "@/actions/dataChanged.js";

export default function AskSeamsBar({ suggestions = [] }) {
  const [q, setQ] = useState("");
  const ask = (text) => {
    const t = String(text || "").trim();
    if (t) openSeamsLookup(t, { ask: true });
  };
  return (
    <section className="ask-bar card mt-4 px-4 py-3.5" aria-label="Ask Seams">
      <p className="text-[12px] font-medium text-[#1C1917]">
        Ask Seams <span className="ml-1 font-normal text-[#6B635A]">· answers from checked records</span>
      </p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ask-input"
          placeholder="e.g. Which customer owes the most?"
          aria-label="Ask Seams a question"
        />
        <button type="submit" className="fix-pill" disabled={!q.trim()}>
          Ask
        </button>
      </form>
      {suggestions.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" className="ask-chip" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
