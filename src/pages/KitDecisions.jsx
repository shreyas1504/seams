// Decisions: what Dana approved or dismissed, with the draft and the reason. Survives every reload.
import React, { useMemo } from "react";
import { useKitFlags } from "@/lib/kitData.js";
import { fmt } from "@/lib/engine/engine.js";

export default function KitDecisions() {
  const [flags, , , { decisions }] = useKitFlags();
  const byId = useMemo(() => new Map(flags.map((f) => [f.finding_id, f])), [flags]);
  const rows = [...decisions].sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)));
  return (
    <section className="card p-6">
      <p className="brief-label">Decisions · kept across reloads</p>
      <h1 className="mt-1 font-display text-[26px] text-[#1C1917]">{rows.length} decisions</h1>
      <div className="mt-4 grid gap-2">
        {rows.map((d) => {
          const f = byId.get(d.finding_id);
          return (
            <details key={d.id} className="evidence-row">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px]">
                  <strong className={d.status === "approved" ? "text-[#1F4D3A]" : "text-[#9F1239]"}>{d.status}</strong> · {f ? f.title : d.finding_id}
                  {!f ? <span className="text-[#6B635A]"> (no longer in findings: fixed)</span> : null}
                </span>
                <span className="text-[12px] text-[#6B635A]">
                  {f ? fmt(f.signed_cents) : ""} · {d.decided_by} · {String(d.decided_at || "").slice(0, 16).replace("T", " ")}
                </span>
              </summary>
              {d.reason ? <p className="mt-2 text-[12px]">Reason: {d.reason}</p> : null}
              {d.draft ? <pre className="mt-2 whitespace-pre-wrap text-[12px] text-[#44403C]">{d.draft}</pre> : null}
            </details>
          );
        })}
        {!rows.length ? <p className="text-[13px] text-[#6B635A]">No decisions yet. Open a cause on Today and draft a fix.</p> : null}
      </div>
    </section>
  );
}
