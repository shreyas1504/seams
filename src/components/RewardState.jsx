// H12 — reward state when no open recoverable/credit flags remain.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";

export default function RewardState({ claimedCents, returnedCents }) {
  return (
    <div
      className="rounded-[28px] bg-[#000000] p-6 text-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      role="status"
      aria-live="polite"
    >
      <p className="text-lg font-semibold">Good service on all lines.</p>
      <p className="mt-2 font-mono text-sm text-[#B8B8B8]">
        {fmt(claimedCents)} claimed, {fmt(returnedCents)} returned this week.
      </p>
    </div>
  );
}
