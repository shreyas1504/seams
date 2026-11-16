// Display helpers that wrap engine fmt; keep money formatting in one place for the UI.
import { fmt } from "@/lib/engine/engine.js";

export function formatCents(cents) {
  return fmt(cents || 0);
}

export function formatNetCents(net) {
  if (net < 0) return "−" + fmt(-net);
  return fmt(net || 0);
}

export function squareUpLabel(party) {
  if (party.net < 0) return `Send ${fmt(-party.net)} credit letter`;
  const amt = party.net || party.overdue || 0;
  return `Square up ${fmt(amt)}`;
}
