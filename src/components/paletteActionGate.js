// Mirror the existing correction-send eligibility without changing backend behavior.
export function paletteApprovalBlock(action, flags) {
  if (action?.action_type === "send_correction" && !flags.some((f) => f.party === action.params?.party && f.status === "needs_review")) {
    return "Nothing left to send. No sent line needs a correction; a cleared gap must not be billed again.";
  }
  return "";
}
