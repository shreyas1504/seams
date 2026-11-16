// H5 — line status board; tap a row to filter customers/vendors.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";

export const LINE_STATUS_ROWS = [
  { key: "CRM→Billing", label: "Contract → Billing", kind: "leak" },
  { key: "Warehouse→Billing", label: "Warehouse → Billing", kind: "leak" },
  { key: "Billing→Cash", label: "Billing → Cash", kind: "amber", status: "Cash to chase" },
  { key: "AP→Vendors", label: "AP → Vendors", kind: "leak" },
  { key: "Returns→Billing", label: "Returns → Billing", kind: "leak" },
  { key: "Credits owed", label: "Credits owed", kind: "green", status: "We owe", filter: "credit_owed" },
];

export default function LineStatusBoard({ rows, activeKey, onSelect }) {
  const max = Math.max(1, ...rows.map((r) => r.cents));
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#14171F]">Line status</h2>
        {activeKey ? (
          <button type="button" onClick={() => onSelect(null)} className="text-xs text-[#3B5BDB]">
            Clear filter
          </button>
        ) : null}
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          if (!r.count) return null;
          const active = activeKey === r.key;
          const bar =
            r.kind === "amber" ? "bg-[#8A5A00]" : r.kind === "green" ? "bg-[#17734B]" : "bg-[#C22A25]";
          const status =
            r.status || (r.kind === "green" ? "We owe" : r.kind === "amber" ? "Cash to chase" : "Leaking");
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect(active ? null : r.key)}
              className={`block w-full rounded-2xl p-2 text-left transition-colors ${
                active ? "bg-[#E8EEFF]" : "hover:bg-[#F5F5F5]"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="text-[#14171F]">
                  {r.label}{" "}
                  <span className="text-xs text-[#5B5F68]">{status}</span>
                </span>
                <span className="font-mono text-xs text-[#14171F]">
                  {fmt(r.cents)} · {r.count}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F0F0F0]">
                <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${(r.cents / max) * 100}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
