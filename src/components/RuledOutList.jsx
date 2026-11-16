// H11 — look-alikes ruled out (collapsed details).
import React from "react";

export default function RuledOutList({ ruled, onOpenId }) {
  if (!ruled?.length) return null;
  return (
    <details className="rounded-[28px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <summary className="cursor-pointer text-sm font-semibold text-[#14171F]">
        Look-alikes ruled out ({ruled.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {ruled.map((r, i) => (
          <li key={i} className="text-xs text-[#5B5F68]">
            <span className="font-medium text-[#14171F]">{r.rule}:</span> {r.reason}
            {r.ids?.length ? (
              <span className="mt-1 block font-mono">
                {r.ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenId?.(id)}
                    className="mr-2 text-[#3B5BDB] underline-offset-2 hover:underline"
                  >
                    {id}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
