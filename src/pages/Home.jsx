// Home: laptop 5/7 sticky layout; phone stacks with Square up visible at 390px.
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
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
import SettlementBar from "@/components/SettlementBar.jsx";
import NeedsReview from "@/components/NeedsReview.jsx";
import LetterDrawer from "@/components/LetterDrawer.jsx";
import RefundDrawer from "@/components/RefundDrawer.jsx";
import TwistCard from "@/components/TwistCard.jsx";
import AskSeams from "@/components/AskSeams.jsx";

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

export default function Home({ role = "admin" }) {
  const [flags, reloadFlags] = useEntity("Flag");
  const [ruled] = useEntity("RuledOut");
  const [patterns, reloadPatterns] = useEntity("Pattern");
  const [settings] = useEntity("Setting");
  const [audits, reloadAudits] = useEntity("AuditEvent");
  const [returns] = useEntity("Return");
  const [filterKey, setFilterKey] = useState(null);
  const [detailFlag, setDetailFlag] = useState(null);
  const [letterParty, setLetterParty] = useState(null);
  const [refundParty, setRefundParty] = useState(null);
  const [since, setSince] = useState(null);
  const [twistBanner, setTwistBanner] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke("recordVisit", {});
        if (!cancelled) setSince(data.since);
      } catch {
        /* visit is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
  const timeline = useMemo(() => {
    if (!detailFlag) return [];
    return [...audits]
      .filter((e) => e.entity_type === "Flag" && e.entity_id === detailFlag.id)
      .sort((a, b) => Date.parse(b.created_at || b.created_date || 0) - Date.parse(a.created_at || a.created_date || 0));
  }, [audits, detailFlag]);

  const onTransition = async (payload) => {
    await base44.functions.invoke("transitionFlag", payload);
    reloadFlags();
    reloadAudits();
  };

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
        <SettlementBar flags={flags} />
        <Scorecard
          flagged={live.filter((f) => f.bucket === "recoverable").length}
          ruledOut={ruled.length}
          overturned={overturned}
          since={since}
          twistBanner={twistBanner}
        />
        <LineStatusBoard rows={boardRows} activeKey={filterKey} onSelect={setFilterKey} />
      </section>

      <section className="space-y-4 md:col-span-7">
        {returns.length ? (
          <TwistCard
            role={role}
            rowsImported={returns.length}
            onDone={(data) => {
              reloadFlags();
              reloadAudits();
              reloadPatterns();
              const c = data?.checks?.counts;
              if (c) {
                setTwistBanner(
                  `Twist applied: +${c.new || 0} new · ${c.cleared || 0} cleared · ${c.needs_review || 0} need review`,
                );
              }
            }}
          />
        ) : null}
        <NeedsReview flags={flags} onOpenFlag={setDetailFlag} />
        {showReward ? (
          <RewardState claimedCents={sumBucket("recoverable")} returnedCents={sumBucket("credit_owed")} />
        ) : (
          <>
            <div>
              <h2 className="mb-3 text-base font-semibold text-[#14171F]">Customers to square up</h2>
              <div className="space-y-3">
                {filteredCustomers.map((p) => (
                  <CustomerCard
                    key={p.party}
                    party={p}
                    onOpenFlag={setDetailFlag}
                    onSquareUp={() => setLetterParty(p)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-base font-semibold text-[#14171F]">Vendors to recover</h2>
              <div className="space-y-3">
                {filteredVendors.map((p) => (
                  <VendorCard
                    key={p.party}
                    party={p}
                    onOpenFlag={setDetailFlag}
                    onRequestRefund={() => setRefundParty(p)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        <AskSeams
          role={role}
          onOpenId={(id) => setDetailFlag(flags.find((f) => (f.ids || []).includes(id)) || null)}
        />
        <PatternList
          patterns={patterns}
          onSuggestFix={async (p) => {
            await base44.entities.SuggestedAction.create({
              source: "pattern",
              action_type: "pattern_fix",
              params: { pattern_key: p.key, fix: p.fix },
              label: `Log fix for ${p.title}?`,
              amount_cents: p.amount_cents,
              status: "proposed",
            });
          }}
        />
        <RuledOutList ruled={ruled} onOpenId={(id) => setDetailFlag(flags.find((f) => (f.ids || []).includes(id)) || null)} />
      </section>

      {detailFlag ? (
        <FlagDetail
          flag={flags.find((f) => f.id === detailFlag.id) || detailFlag}
          timeline={timeline}
          role={role}
          onClose={() => setDetailFlag(null)}
          onTransition={onTransition}
        />
      ) : null}
      {letterParty ? (
        <LetterDrawer
          party={letterParty.party}
          kind="customer"
          role={role}
          cardNet={letterParty.net}
          onClose={() => setLetterParty(null)}
          onSent={() => { reloadFlags(); reloadAudits(); setLetterParty(null); }}
        />
      ) : null}
      {refundParty ? (
        <RefundDrawer
          party={refundParty.party}
          role={role}
          onClose={() => setRefundParty(null)}
          onSent={() => { reloadFlags(); reloadAudits(); setRefundParty(null); }}
        />
      ) : null}
    </div>
  );
}
