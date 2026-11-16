// H4 — scorecard line + optional twist banner.
import React from "react";

export default function Scorecard({ flagged, ruledOut, overturned, since, twistBanner }) {
  return (
    <div className="rounded-[24px] border border-[#E2DDD2] bg-white px-4 py-3 text-sm text-[#5B5F68] shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
      {twistBanner ? (
        <div className="mb-2 rounded-2xl bg-[#E8EEFF] px-3 py-2 text-xs text-[#3B5BDB]">{twistBanner}</div>
      ) : null}
      <p className="font-mono text-xs leading-relaxed text-[#14171F]">
        {flagged} flagged · {ruledOut} look-alikes ruled out · {overturned} overturned
        {since ? (
          <>
            {" "}
            · since your last visit: +{since.new ?? 0} new, {since.cleared ?? 0} cleared, {since.sent ?? 0} sent
          </>
        ) : null}
      </p>
    </div>
  );
}
