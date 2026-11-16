// Settings: as-of, thresholds, rule switches, four-eyes, reset demo. Analyst read-only.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_SETTINGS, RULES } from "@/lib/engine/engine.js";
import { TWIST_RULE_IDS } from "@/lib/twistSpec.js";

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

  if (!row) return <p className="text-[#5B5F68]">Loading…</p>;

  const enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(row.rule_enabled || {}) };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[#5B5F68]">
          {readOnly ? "Read-only for Analyst — Controller only to change." : "Every change writes a reversible AuditEvent."}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["as_of_date", "As-of date", "text"],
            ["overdue_days", "Overdue days", "number"],
            ["po_abs_cents", "PO tolerance (¢)", "number"],
            ["po_pct", "PO tolerance (%)", "number"],
            ["match_window_days", "Match window (days)", "number"],
            ["four_eyes_threshold_cents", "Four-eyes threshold (¢)", "number"],
          ].map(([key, label, type]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                type={type}
                disabled={readOnly}
                value={row[key] ?? ""}
                onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-[#F5F5F5] px-3 disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold">Rules</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {RULE_IDS.map((id) => (
            <label key={id} className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#F5F5F5] px-3 text-sm">
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
              <span className="font-mono text-xs">{id}</span>
              <span className="text-[#5B5F68]">{RULES[id]?.name || id}</span>
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
            className="min-h-[44px] rounded-2xl bg-[#000000] px-4 text-sm text-white disabled:opacity-40"
          >
            Save settings
          </button>
        </div>
        {msg ? <p className="mt-2 text-xs text-[#5B5F68]">{msg}</p> : null}
      </div>
    </div>
  );
}
