import { fmt } from "@/lib/engine/engine.js";

export function seamsActorName(email) {
  const name = String(email || "System").split("@")[0].split(/[._]/)[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const SEAMS_PLAIN_ENTITY = {
  Contract: "CRM contracts",
  Shipment: "warehouse shipments",
  Invoice: "billing invoices",
  VendorBill: "vendor bills",
  Return: "the returns log",
  SuggestedAction: "a suggested action",
  Flag: "findings",
  Setting: "settings",
  Letter: "a letter",
};

export function seamsEntityLabel(name) {
  const t = SEAMS_PLAIN_ENTITY[name];
  return t ? t.replace(/^(a |the )/, "").replace(/^./, (c) => c.toUpperCase()) : name;
}

/** "2026-11-16T16:21:05Z" -> "Nov 16, 4:21 PM" in the viewer's time zone. */
export function seamsAuditTime(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function seamsAuditSentence(event) {
  const actor = seamsActorName(event.actor_email);
  const info = event.after || {};
  const party = info.party || "";
  const amount = info.total_cents != null ? ` · ${fmt(Math.abs(info.total_cents))}` : "";
  switch (event.action) {
    case "send_letter":
      if (info.second_approver) return `${actor} approved as second Controller and sent ${info.kind === "vendor" ? "a refund request" : "a settlement"}${party ? ` to ${party}` : ""}${amount}`;
      return `${actor} sent ${info.kind === "vendor" ? "a refund request" : info.kind === "correction" ? "a correction" : "a settlement"}${party ? ` to ${party}` : ""}${amount}`;
    case "pending_second": return `${actor} requested ${info.kind === "vendor" ? "a refund" : "approval"}${party ? ` for ${party}` : ""}${amount}`;
    case "transition_flag": return `${actor} marked a finding ${String(info.status || "updated").replace(/_/g, " ")}${event.reason ? ` — ${event.reason}` : ""}`;
    case "approve_twist_rules": return `${actor} approved the returns checks`;
    case "revoke_twist_rules": return `${actor} revoked the returns checks`;
    case "reset_demo": return `${actor} reset the demo data`;
    case "import":
    case "import_rows": return `${actor} loaded ${SEAMS_PLAIN_ENTITY[event.entity_type] || "data"}${info.rows != null ? ` (${info.rows} rows)` : info.imported != null ? ` (${info.imported} rows)` : ""}`;
    case "update_settings": return `${actor} changed settings`;
    case "run_checks": return `${actor} ran checks${info.new != null ? ` · ${info.new} new, ${info.cleared || 0} cleared` : ""}`;
    case "visit": return `${actor} opened Seams`;
    case "undo": return `${actor} undid a change`;
    case "execute_action": return `${actor} approved a suggested action`;
    case "reject_action": return `${actor} rejected a suggestion`;
    default: return `${actor} ${String(event.action || "updated data").replace(/_/g, " ")}`;
  }
}
