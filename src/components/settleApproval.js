// Four-eyes helper for the settle drawers: did the signed-in user request this pending send?
// The backend already refuses a self-approval (403); this lets the drawer say so before anyone clicks.
import { base44 } from "@/api/base44Client";

export async function settleRequestedBySelf(actionId) {
  if (!actionId) return false;
  try {
    const [me, actions] = await Promise.all([base44.auth.me(), base44.entities.SuggestedAction.list(undefined, 5000)]);
    const a = (actions || []).find((x) => x.id === actionId);
    return Boolean(me?.email && a?.params?.requested_by && a.params.requested_by === me.email);
  } catch {
    return false;
  }
}

/** The lines and tone the requester chose for a pending send, so the approver sees exactly that letter. */
export async function settlePendingParams(actionId) {
  if (!actionId) return null;
  try {
    const actions = await base44.entities.SuggestedAction.list(undefined, 5000);
    return (actions || []).find((x) => x.id === actionId)?.params || null;
  } catch {
    return null;
  }
}

/** Server errors in words Dana can act on. */
export function settleFriendlyError(e) {
  const msg = e?.response?.data?.error || e?.message || "Something went wrong";
  if (/total mismatch/i.test(msg)) return "This request is out of date: a line changed after it was requested. Cancel it and send again.";
  if (/same user|own request|requested by/i.test(msg) || e?.response?.status === 403) return "A different Controller has to approve this send.";
  return msg;
}
