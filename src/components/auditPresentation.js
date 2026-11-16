import { fmt } from "@/lib/engine/engine.js";

export function seamsActorName(email) {
  const name = String(email || "System").split("@")[0].split(/[._]/)[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function seamsAuditSentence(event) {
  const actor = seamsActorName(event.actor_email);
  const info = event.after || {};
  const party = info.party || "";
  const amount = info.total_cents != null ? ` · ${fmt(Math.abs(info.total_cents))}` : "";
  switch (event.action) {
    case "send_letter": return `${actor} sent ${info.kind === "vendor" ? "a refund request" : info.kind === "correction" ? "a correction" : "a settlement"}${party ? ` to ${party}` : ""}${amount}`;
    case "pending_second": return `${actor} requested ${info.kind === "vendor" ? "a refund" : "approval"}${party ? ` for ${party}` : ""}${amount}`;
    case "transition_flag": return `${actor} marked a finding ${String(info.status || "updated").replace(/_/g, " ")}${event.reason ? ` — ${event.reason}` : ""}`;
    case "approve_twist_rules": return `${actor} approved the returns checks`;
    case "revoke_twist_rules": return `${actor} revoked the returns checks`;
    case "reset_demo": return `${actor} reset the demo data`;
    case "import_rows": return `${actor} imported ${event.entity_type || "data"} records`;
    case "run_checks": return `${actor} ran checks${info.new != null ? ` · ${info.new} new, ${info.cleared || 0} cleared` : ""}`;
    case "visit": return `${actor} opened Seams`;
    case "undo": return `${actor} undid a change`;
    case "execute_action": return `${actor} approved a suggested action`;
    case "reject_action": return `${actor} rejected a suggestion`;
    default: return `${actor} ${String(event.action || "updated data").replace(/_/g, " ")}`;
  }
}
