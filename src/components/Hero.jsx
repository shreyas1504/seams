// H2 — owed to Northline hero with overdue / we-owe chips.
import React from "react";
import { fmt } from "@/lib/engine/engine.js";

export default function Hero({ recoverableCents, overdueCents, creditCents, customerCount, vendorCount }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <p className="text-sm text-[#5B5F68]">This morning Seams found</p>
      <div className="mt-1 font-mono text-[40px] font-semibold leading-none tracking-tight text-[#C22A25]">
        {fmt(recoverableCents)}
      </div>
      <p className="mt-2 text-sm text-[#14171F]">
        owed to Northline · {customerCount} customers to square up · {vendorCount} vendors to recover
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#FBEFD6] px-3 py-1.5 font-mono text-xs text-[#8A5A00]">
          {fmt(overdueCents)} overdue to chase
        </span>
        <span className="rounded-full bg-[#E6F4EC] px-3 py-1.5 font-mono text-xs text-[#17734B]">
          {fmt(creditCents)} we owe customers
        </span>
      </div>
    </div>
  );
}
