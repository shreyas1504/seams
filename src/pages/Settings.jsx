// Settings: as-of, thresholds, rule switches, four-eyes, reset demo. Analyst read-only.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_SETTINGS, RULES } from "@/lib/engine/engine.js";
import { TWIST_RULE_IDS } from "@/lib/twistSpec.js";

const TWIST_RULE_NAMES = {
  dup_credit_memo: "Credit memo applied twice",
  missing_credit: "Return with no credit issued",
  return_explains_short: "Return explains a short shipment",
};
const RULE_IDS = [...Object.keys(RULES), ...TWIST_RULE_IDS.filter((id) => !RULES[id])];

export default function Settings({ role = "admin" }) {
  const [row, setRow] = useState(null);
  const [msg, setMsg] = useState("");
  const readOnly = role !== "admin";

  async function load() {
    const list = await base44.entities.Setting.list();
    setRow(list[0] || { ...DEFAULT_SETTINGS, rule_enabled: {} });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(patch) {
    if (readOnly) {
      setMsg("Controller only");
      return;
    }
    const list = await base44.entities.Setting.list();
    const cur = list[0];
    if (!cur) return;
    const before = { ...cur };
    const next = { ...cur, ...patch };
    if (patch.rule_enabled) next.rule_enabled = { ...(cur.rule_enabled || {}), ...patch.rule_enabled };
    await base44.entities.Setting.update(cur.id, {
      as_of_date: next.as_of_date,
      overdue_days: Number(next.overdue_days),
      po_abs_cents: Number(next.po_abs_cents),
      po_pct: Number(next.po_pct),
      match_window_days: Number(next.match_window_days),
      four_eyes_threshold_cents: Number(next.four_eyes_threshold_cents),
      rule_enabled: next.rule_enabled,
    });
    const user = await base44.auth.me();
    await base44.entities.AuditEvent.create({
      actor_email: user.email,
      actor_role: user.role,
      action: "update_settings",
      entity_type: "Setting",
      entity_id: cur.id,
      before,
      after: next,
      created_at: new Date().toISOString(),
      reversible: true,
      undone: false,
    });
    setMsg("Saved.");
    load();
  }

  if (!row) return <p className="text-[#6B635A]">Loading…</p>;

  const enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(row.rule_enabled || {}) };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <p className="brief-label">How Seams checks</p>
        <h1 className="mt-1 font-display text-[28px] font-medium text-[#1C1917]">Settings</h1>
        <p className="mt-1 text-[13px] text-[#6B635A]">
          {readOnly ? "Read-only for Analysts. A Controller can change these." : "Every change is logged in Activity and can be undone."}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["as_of_date", "Check data as of", "text", "Date the overdue clock counts from"],
            ["overdue_days", "Overdue after (days past due)", "number", "Invoices unpaid this long count as late"],
            ["po_abs_cents", "Vendor bill may exceed its PO by ($)", "dollars", "Smaller differences are ignored"],
            ["po_pct", "…or by (%)", "percent", "Whichever is larger"],
            ["match_window_days", "Match shipments to invoices within (days)", "number", "How far apart the dates may be"],
            ["four_eyes_threshold_cents", "Second Controller must approve sends over ($)", "dollars", "Four-eyes rule for letters and refunds"],
          ].map(([key, label, type, hint]) => (
            <label key={key} className="block text-[13px] font-medium text-[#1C1917]">
              {label}
              <input
                type={type === "dollars" || type === "percent" ? "number" : type}
                step={type === "dollars" ? "0.01" : type === "percent" ? "0.1" : undefined}
                min={type === "text" ? undefined : 0}
                disabled={readOnly}
                value={
                  row[key] === "" || row[key] == null
                    ? ""
                    : type === "dollars"
                      ? Number(row[key]) / 100
                      : type === "percent"
                        ? Math.round(Number(row[key]) * 10000) / 100
                        : row[key]
                }
                onChange={(e) =>
                  setRow({
                    ...row,
                    [key]:
                      e.target.value === "" || type === "text" || type === "number"
                        ? e.target.value
                        : type === "dollars"
                          ? Math.round(Number(e.target.value) * 100)
                          : Number(e.target.value) / 100,
                  })
                }
                className="settings-input mt-1"
              />
              <span className="mt-1 block text-[11.5px] font-normal text-[#6B635A]">{hint}</span>
            </label>
          ))}
        </div>

        <h2 className="mt-7 font-display text-[18px] font-semibold text-[#1C1917]">Checks</h2>
        <p className="mt-1 text-[12px] text-[#6B635A]">Turn a check off if the data can't support it. Returns checks switch on when you approve a returns file.</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {RULE_IDS.map((id) => (
            <label key={id} className="settings-check" title={id}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={enabled[id] !== false}
                onChange={(e) =>
                  setRow({
                    ...row,
                    rule_enabled: { ...(row.rule_enabled || {}), [id]: e.target.checked },
                  })
                }
              />
              <span className="text-[13px] text-[#1C1917]">{RULES[id]?.name || TWIST_RULE_NAMES[id] || id.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={readOnly}
            title={readOnly ? "Controller only" : undefined}
            onClick={() =>
              save({
                as_of_date: row.as_of_date,
                overdue_days: row.overdue_days,
                po_abs_cents: row.po_abs_cents,
                po_pct: row.po_pct,
                match_window_days: row.match_window_days,
                four_eyes_threshold_cents: row.four_eyes_threshold_cents,
                rule_enabled: row.rule_enabled,
              })
            }
            className="btn-forest"
          >
            Save settings
          </button>
        </div>
        {msg ? <p className="mt-2 text-[12px] text-[#0F766E]" role="status">{msg}</p> : null}
      </div>
    </div>
  );
}
