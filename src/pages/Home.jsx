// Home: laptop 5/7 sticky layout; phone stacks with Square up visible at 390px.
import React, { useMemo, useState } from "react";
import { useEntity } from "@/lib/useEntity";
import { rankParties } from "@/lib/engine/engine.js";
import Hero from "@/components/Hero.jsx";
import Scorecard from "@/components/Scorecard.jsx";
import LineStatusBoard, { LINE_STATUS_ROWS } from "@/components/LineStatusBoard.jsx";
import CustomerCard from "@/components/CustomerCard.jsx";
import VendorCard from "@/components/VendorCard.jsx";
import PatternList from "@/components/PatternList.jsx";
import RuledOutList from "@/components/RuledOutList.jsx";
import RewardState from "@/components/RewardState.jsx";
import LookupBox from "@/components/LookupBox.jsx";
import FlagDetail from "@/components/FlagDetail.jsx";

const LIVE_STATUSES = new Set(["open", "sent", "disputed"]);

function buildBoardRows(live) {
  return LINE_STATUS_ROWS.map((row) => {
    if (row.filter === "credit_owed") {
      const fs = live.filter((f) => f.bucket === "credit_owed");
      return { ...row, cents: fs.reduce((a, f) => a + f.amount_cents, 0), count: fs.length };
    }
    const fs = live.filter((f) => f.seam === row.key);
    return { ...row, cents: fs.reduce((a, f) => a + f.amount_cents, 0), count: fs.length };
  });
}

function partyMatchesFilter(party, filterKey) {
  if (!filterKey) return true;
  if (filterKey === "Credits owed") return party.flags.some((f) => f.bucket === "credit_owed");
  return party.flags.some((f) => f.seam === filterKey);
}

export default function Home() {
  const [flags] = useEntity("Flag");
  const [ruled] = useEntity("RuledOut");
  const [patterns] = useEntity("Pattern");
  const [settings] = useEntity("Setting");
  const [filterKey, setFilterKey] = useState(null);
  const [detailFlag, setDetailFlag] = useState(null);

  const live = useMemo(() => flags.filter((f) => LIVE_STATUSES.has(f.status)), [flags]);
  const sumBucket = (b) => live.filter((f) => f.bucket === b).reduce((a, f) => a + f.amount_cents, 0);
  const { customers, vendors } = useMemo(() => rankParties(live), [live]);
  const boardRows = useMemo(() => buildBoardRows(live), [live]);
  const filteredCustomers = customers.filter((p) => partyMatchesFilter(p, filterKey));
  const filteredVendors = vendors.filter((p) => partyMatchesFilter(p, filterKey));
  const openRecoverableOrCredit = live.filter((f) => f.bucket === "recoverable" || f.bucket === "credit_owed");
  const overturned = flags.filter((f) => f.status === "dismissed" && f.dismiss_reason === "Not a leak").length;
  const asOf = settings[0]?.as_of_date || "2026-10-01";
  const showReward = flags.length > 0 && openRecoverableOrCredit.length === 0;

  if (!flags.length) {
    return (
      <div className="rounded-[28px] bg-white p-6 text-[#5B5F68] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        No data yet. Go to Data → Reset demo.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-12 md:gap-5">
      <section className="space-y-4 md:col-span-5 md:sticky md:top-4 md:self-start">
        <header className="px-1">
          <p className="text-sm text-[#5B5F68]">As of {asOf}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#14171F]">
            Seams <span className="font-normal text-[#5B5F68]">· Mind the gap</span>
          </h1>
        </header>
        <LookupBox onOpenFlag={setDetailFlag} />
        <Hero
          recoverableCents={sumBucket("recoverable")}
          overdueCents={sumBucket("overdue")}
          creditCents={sumBucket("credit_owed")}
          customerCount={customers.length}
          vendorCount={vendors.length}
        />
        <Scorecard
          flagged={live.filter((f) => f.bucket === "recoverable").length}
          ruledOut={ruled.length}
          overturned={overturned}
        />
        <LineStatusBoard rows={boardRows} activeKey={filterKey} onSelect={setFilterKey} />
      </section>

      <section className="space-y-4 md:col-span-7">
        {showReward ? (
          <RewardState claimedCents={sumBucket("recoverable")} returnedCents={sumBucket("credit_owed")} />
        ) : (
          <>
            <div>
              <h2 className="mb-3 text-base font-semibold text-[#14171F]">Customers to square up</h2>
              <div className="space-y-3">
                {filteredCustomers.map((p) => (
                  <CustomerCard key={p.party} party={p} onOpenFlag={setDetailFlag} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-base font-semibold text-[#14171F]">Vendors to recover</h2>
              <div className="space-y-3">
                {filteredVendors.map((p) => (
                  <VendorCard key={p.party} party={p} onOpenFlag={setDetailFlag} />
                ))}
              </div>
            </div>
          </>
        )}
        <PatternList patterns={patterns} />
        <RuledOutList ruled={ruled} onOpenId={(id) => setDetailFlag(flags.find((f) => (f.ids || []).includes(id)) || null)} />
      </section>

      {detailFlag ? (
        <FlagDetail flag={detailFlag} timeline={[]} onClose={() => setDetailFlag(null)} />
      ) : null}
    </div>
  );
}
