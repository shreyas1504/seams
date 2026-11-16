// Overview — CRMEdge layout: KPIs, gauge, top parties, document-style settlement cards.
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { rankParties, totalsOf, fmt } from "@/lib/engine/engine.js";
import { formatNetCents, squareUpLabel } from "@/lib/format.js";
import FlagDetail from "@/components/FlagDetail.jsx";
import LetterDrawer from "@/components/LetterDrawer.jsx";
import RefundDrawer from "@/components/RefundDrawer.jsx";
import TwistCard from "@/components/TwistCard.jsx";
import AskSeams from "@/components/AskSeams.jsx";
import PatternList from "@/components/PatternList.jsx";
import RuledOutList from "@/components/RuledOutList.jsx";
import NeedsReview from "@/components/NeedsReview.jsx";
import RewardState from "@/components/RewardState.jsx";
import SideBySide from "@/components/SideBySide.jsx";

const LIVE = new Set(["open", "sent", "disputed"]);

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function statusTag(party) {
  if (party.flags.some((f) => f.status === "sent")) return { label: "Letter sent", cls: "crm-tag-ok" };
  if (party.flags.some((f) => f.status === "needs_review")) return { label: "Needs review", cls: "crm-tag-warn" };
  if (party.net < 0) return { label: "Credit owed", cls: "crm-tag-credit" };
  if (party.overdue && !party.owed_to_us) return { label: "Overdue", cls: "crm-tag-warn" };
  return { label: "Open gap", cls: "crm-tag-leak" };
}

export default function Home({ role = "admin", headerLookup = "", headerLookupSignal = 0, onGoData }) {
  const [flags, reloadFlags] = useEntity("Flag");
  const [ruled] = useEntity("RuledOut");
  const [patterns, reloadPatterns] = useEntity("Pattern");
  const [settings] = useEntity("Setting");
  const [audits, reloadAudits] = useEntity("AuditEvent");
  const [returns] = useEntity("Return");
  const [detailFlag, setDetailFlag] = useState(null);
  const [letterParty, setLetterParty] = useState(null);
  const [refundParty, setRefundParty] = useState(null);
  const [since, setSince] = useState(null);
  const [twistBanner, setTwistBanner] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupErr, setLookupErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke("recordVisit", {});
        if (!cancelled) setSince(data.since);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!headerLookupSignal || !headerLookup.trim()) return;
    let cancelled = false;
    (async () => {
      setLookupErr("");
      try {
        const { data } = await base44.functions.invoke("lookupRecord", { id: headerLookup.trim() });
        if (!cancelled) setLookupResult(data);
      } catch (e) {
        if (!cancelled) {
          setLookupErr(e?.response?.data?.error || e.message);
          setLookupResult(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headerLookupSignal, headerLookup]);

  const live = useMemo(() => flags.filter((f) => LIVE.has(f.status || "open")), [flags]);
  const totals = useMemo(() => totalsOf(live), [live]);
  const { customers, vendors } = useMemo(() => rankParties(live), [live]);
  const asOf = settings[0]?.as_of_date || "2026-11-13";
  const openWork = live.filter((f) => f.bucket === "recoverable" || f.bucket === "credit_owed");
  const showReward = flags.length > 0 && openWork.length === 0;

  const sentCents = flags.filter((f) => f.status === "sent").reduce((a, f) => a + f.amount_cents, 0);
  const openCents = live.reduce((a, f) => a + f.amount_cents, 0) || 1;
  const settledPts = Math.min(100, Math.round((sentCents / (openCents + sentCents || 1)) * 100));

  const timeline = useMemo(() => {
    if (!detailFlag) return [];
    return [...audits]
      .filter((e) => e.entity_type === "Flag" && e.entity_id === detailFlag.id)
      .sort(
        (a, b) =>
          Date.parse(b.created_at || b.created_date || 0) -
          Date.parse(a.created_at || a.created_date || 0),
      );
  }, [audits, detailFlag]);

  const onTransition = async (payload) => {
    await base44.functions.invoke("transitionFlag", payload);
    reloadFlags();
    reloadAudits();
  };

  const board = useMemo(() => {
    const seams = [
      { key: "AP→Vendors", label: "AP → Vendors" },
      { key: "Warehouse→Billing", label: "Warehouse → Billing" },
      { key: "CRM→Billing", label: "CRM → Billing" },
      { key: "Billing→Cash", label: "Billing → Cash" },
    ];
    return seams
      .map((s) => {
        const fs = live.filter((f) => f.seam === s.key);
        return { ...s, n: fs.length, cents: fs.reduce((a, f) => a + f.amount_cents, 0) };
      })
      .filter((s) => s.n);
  }, [live]);

  if (!flags.length) {
    return (
      <div className="crm-card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-2 text-sm text-[#6B6B76]">No data yet. Load the four Northline systems to find the gaps.</p>
        <button type="button" className="crm-btn-black mt-5" onClick={onGoData}>
          Go to Data → Reset demo
        </button>
      </div>
    );
  }

  const docs = [...customers.slice(0, 4), ...vendors.slice(0, 2)];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-[#6B6B76]">
            Monitor every gap across CRM, warehouse, billing and AP.
          </p>
        </div>
        <div className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#E4E4E8] bg-white px-3 text-sm font-semibold">
          <span aria-hidden>📅</span>
          As of {asOf}
        </div>
      </div>

      {twistBanner ? (
        <div className="rounded-2xl bg-[#E8F6D8] px-4 py-2.5 text-sm font-semibold text-[#3D5C12]" role="status">
          {twistBanner}
        </div>
      ) : null}

      {(lookupResult || lookupErr) && (
        <section className="crm-card p-4" aria-label="Lookup result">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Lookup · {headerLookup}</h2>
            <button type="button" className="text-xs font-semibold text-[#6B6B76]" onClick={() => { setLookupResult(null); setLookupErr(""); }}>
              Clear
            </button>
          </div>
          {lookupErr ? <p className="text-sm font-semibold text-[#C22A25]">{lookupErr}</p> : null}
          {lookupResult?.kind === "not_found" ? (
            <p className="text-sm text-[#6B6B76]">Not found in any of the 4 systems</p>
          ) : null}
          {lookupResult?.kind === "ruled_out"
            ? lookupResult.ruled.map((r, i) => (
                <p key={i} className="text-sm text-[#6B6B76]">
                  <span className="font-bold text-[#111]">{r.rule}:</span> {r.reason}
                </p>
              ))
            : null}
          {lookupResult?.kind === "flagged"
            ? lookupResult.flags.map((f) => (
                <div key={f.id || f.stable_key} className="mt-2">
                  <button type="button" className="text-sm font-semibold" onClick={() => setDetailFlag(f)}>
                    {f.rule} · {f.party} · {fmt(f.amount_cents)}
                  </button>
                  <SideBySide flag={f} />
                </div>
              ))
            : null}
        </section>
      )}

      {/* KPI row */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Key totals">
        <article className="crm-card p-4">
          <p className="text-sm font-medium text-[#6B6B76]">Owed to Northline</p>
          <p className="mt-2 font-mono text-[28px] font-bold leading-none text-[#C22A25]">
            {fmt(totals.recoverable.cents)}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#3D5C12]">
            {totals.recoverable.n} recoverable flags
            {since ? ` · +${since.new ?? 0} since last visit` : ""}
          </p>
        </article>
        <article className="crm-card p-4">
          <p className="text-sm font-medium text-[#6B6B76]">Overdue to chase</p>
          <p className="mt-2 font-mono text-[28px] font-bold leading-none text-[#8A4B12]">
            {fmt(totals.overdue.cents)}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#8A4B12]">{totals.overdue.n} open invoices past due</p>
        </article>
        <article className="crm-card p-4">
          <p className="text-sm font-medium text-[#6B6B76]">We owe customers</p>
          <p className="mt-2 font-mono text-[28px] font-bold leading-none text-[#17734B]">
            {fmt(totals.credit_owed.cents)}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#17734B]">
            {totals.credit_owed.n} credits · fair both ways
          </p>
        </article>
      </section>

      {/* Mid grid: gauge + top parties + documents */}
      <section className="grid gap-3 lg:grid-cols-12">
        <article className="crm-card p-5 lg:col-span-4">
          <h2 className="text-base font-bold">Settlement progress</h2>
          <div
            className="gauge-ring mt-5"
            style={{
              background: `conic-gradient(#C6F135 0 ${settledPts * 3.6}deg, #111111 ${settledPts * 3.6}deg 360deg)`,
            }}
            role="img"
            aria-label={`${settledPts} of 100 settlement points`}
          >
            <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-white text-center">
              <p className="font-mono text-3xl font-bold">{settledPts}</p>
              <p className="text-xs font-medium text-[#6B6B76]">of 100 points</p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#ECECEF] pt-4">
            <p className="text-base font-bold">
              {settledPts >= 50 ? "Letters are moving ✨" : "Gaps still open"}
            </p>
            <p className="mt-1 text-sm text-[#6B6B76]">
              {customers.length} customers to square up · {vendors.length} vendors to recover · {ruled.length}{" "}
              look-alikes ruled out.
            </p>
          </div>
        </article>

        <article className="crm-card p-5 lg:col-span-3">
          <h2 className="text-base font-bold">Top accounts</h2>
          <ul className="mt-3 space-y-3">
            {[...customers, ...vendors].slice(0, 6).map((p) => (
              <li key={p.party}>
                <button
                  type="button"
                  onClick={() => (p.lane === "vendor" ? setRefundParty(p) : setLetterParty(p))}
                  className="flex min-h-[44px] w-full items-center gap-2.5 text-left"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0F0F2] text-[11px] font-bold"
                    aria-hidden
                  >
                    {initials(p.party)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.party}</span>
                    <span className="block text-xs text-[#6B6B76]">
                      {p.flags.length} lines · {p.lane}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-sm font-bold ${p.net < 0 ? "text-[#17734B]" : "text-[#111]"}`}
                  >
                    {formatNetCents(p.net || p.overdue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <div className="space-y-3 lg:col-span-5">
          <h2 className="px-1 text-base font-bold">Settlements</h2>
          {docs.map((p) => {
            const tag = statusTag(p);
            const topFlag = p.flags[0];
            return (
              <article key={p.party} className="crm-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`crm-tag ${tag.cls}`}>{tag.label}</span>
                  <button
                    type="button"
                    className="crm-btn-black !min-h-[36px] !px-3 !text-xs"
                    onClick={() => (p.lane === "vendor" ? setRefundParty(p) : setLetterParty(p))}
                  >
                    {p.lane === "vendor" ? `Request ${fmt(p.net)}` : squareUpLabel(p)}
                  </button>
                </div>
                <p className="mt-2 text-base font-bold">{p.party}</p>
                <p className="text-xs text-[#6B6B76]">
                  {topFlag?.ids?.[0] || "—"} · {topFlag?.rule || p.lane}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#6B6B76]">Net</p>
                    <p className="font-mono font-bold">{formatNetCents(p.net || p.overdue)}</p>
                  </div>
                  <div>
                    <p className="text-[#6B6B76]">Recoverable</p>
                    <p className="font-mono font-bold">{fmt(p.owed_to_us || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[#6B6B76]">We owe</p>
                    <p className="font-mono font-bold">{fmt(p.we_owe || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[#6B6B76]">Overdue</p>
                    <p className="font-mono font-bold">{fmt(p.overdue || 0)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-between border-t border-[#ECECEF] pt-2 text-[11px] text-[#6B6B76]">
                  <span>Seam · {topFlag?.seam || "—"}</span>
                  <button type="button" className="font-semibold text-[#111]" onClick={() => setDetailFlag(topFlag)}>
                    Open proof →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Line status as soft KPI strip */}
      <section className="crm-card p-4" aria-label="Line status by seam">
        <h2 className="text-sm font-bold">Gaps by system pair</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {board.map((row) => (
            <div key={row.key} className="rounded-2xl bg-[#F7F7F8] px-3 py-3">
              <p className="text-xs font-medium text-[#6B6B76]">{row.label}</p>
              <p className="mt-1 font-mono text-lg font-bold">{fmt(row.cents)}</p>
              <p className="text-[11px] font-semibold text-[#6B6B76]">{row.n} flags</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data flow explainer */}
      <section className="crm-card flex flex-wrap items-center gap-2 px-4 py-3" aria-label="How data works">
        <span className="text-xs font-bold">Flow</span>
        {["CRM", "Warehouse", "Billing", "AP"].map((s, i) => (
          <React.Fragment key={s}>
            <span className="rounded-full bg-[#F0F0F2] px-2.5 py-1 text-xs font-semibold">{s}</span>
            {i < 3 ? <span className="text-[#6B6B76]">→</span> : null}
          </React.Fragment>
        ))}
        <span className="rounded-full bg-[#C6F135] px-2.5 py-1 text-xs font-bold text-[#2A3A00]">
          Seams compares in code
        </span>
        <span className="ml-auto text-[11px] font-medium text-[#6B6B76]">AI suggests · Dana approves</span>
      </section>

      <div className="space-y-3">
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
          <RewardState
            claimedCents={flags.filter((f) => f.status === "recovered").reduce((a, f) => a + f.amount_cents, 0)}
            returnedCents={flags.filter((f) => f.status === "credited").reduce((a, f) => a + f.amount_cents, 0)}
          />
        ) : null}
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
        <RuledOutList
          ruled={ruled}
          onOpenId={(id) => setDetailFlag(flags.find((f) => (f.ids || []).includes(id)) || null)}
        />
      </div>

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
          onSent={() => {
            reloadFlags();
            reloadAudits();
            setLetterParty(null);
          }}
        />
      ) : null}
      {refundParty ? (
        <RefundDrawer
          party={refundParty.party}
          role={role}
          onClose={() => setRefundParty(null)}
          onSent={() => {
            reloadFlags();
            reloadAudits();
            setRefundParty(null);
          }}
        />
      ) : null}
    </div>
  );
}
