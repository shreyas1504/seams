// Today: morning brief + "Where it slipped" on top; "Today's fixes" + "Proof · Trace" below.
// Every sentence is a code template over engine numbers. No LLM text.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { totalsOf, fmt } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { seamLabel, seamTint, shortDate } from "@/components/systems.js";
import WhereItSlipped from "@/components/WhereItSlipped.jsx";
import TodaysFixes, { FIX_COLLAPSE_MS } from "@/components/TodaysFixes.jsx";
import ProofTrace from "@/components/ProofTrace.jsx";
import LetterDrawer from "@/components/LetterDrawer.jsx";
import RefundDrawer from "@/components/RefundDrawer.jsx";
import { fixPatternFor, fixRootCause } from "@/components/fixProof.js";
import { announceSeamsDataChanged, onSeamsDataChanged } from "@/actions/dataChanged.js";

const TODAY_LIVE = new Set(["open", "sent", "disputed"]);
const TODAY_GONE = new Set(["dismissed", "cleared"]);

// Plain-language phrase per rule: [singular, plural].
const RULE_PHRASE = {
  dup_payment: ["vendor paid twice", "vendors paid twice"],
  over_po: ["vendor bill over its PO", "vendor bills over their PO"],
  unbilled: ["shipment never invoiced", "shipments never invoiced"],
  short_billed: ["invoice short-billed", "invoices short-billed"],
  below_contract: ["invoice below contract price", "invoices below contract price"],
  freight: ["shipment with freight not rebilled", "shipments with freight not rebilled"],
  dup_credit_memo: ["credit memo issued twice", "credit memos issued twice"],
};

function rulePhrase(ruleId, ruleName, n) {
  const p = RULE_PHRASE[ruleId];
  if (p) return n === 1 ? p[0] : p[1];
  return String(ruleName || ruleId || "issues").toLowerCase();
}

function sumCents(fs) {
  return fs.reduce((a, f) => a + (f.amount_cents || 0), 0);
}

function mostCommon(values) {
  const m = new Map();
  for (const v of values) if (v) m.set(v, (m.get(v) || 0) + 1);
  let best = null;
  for (const [v, n] of m) if (!best || n > best[1]) best = [v, n];
  return best ? best[0] : null;
}

function SeamPill({ seam, children, label }) {
  const { selectedSeam, setSelectedSeam } = useSelectedSeam();
  const tint = seamTint(seam);
  const active = selectedSeam === seam;
  return (
    <button
      type="button"
      className="seam-pill"
      style={{ background: tint.bg, color: tint.ink, boxShadow: active ? `inset 0 0 0 1.5px ${tint.ink}` : undefined }}
      aria-pressed={active}
      aria-label={label}
      onClick={() => setSelectedSeam(seam)}
    >
      {children}
    </button>
  );
}

export default function Today({ role = "admin" }) {
  // One flag list feeds both the brief and the map, so they always update together.
  const [flags, reloadFlags] = useEntity("Flag");
  const [ruled, reloadRuled] = useEntity("RuledOut");
  const [patterns, reloadPatterns] = useEntity("Pattern");
  const [actions, reloadActions] = useEntity("SuggestedAction");
  const [contracts] = useEntity("Contract");
  const [shipments] = useEntity("Shipment");
  const [invoices] = useEntity("Invoice");
  const [bills] = useEntity("VendorBill");
  const [returns] = useEntity("Return");
  const [visit, setVisit] = useState(null);
  const { selectedSeam, selectedFlagKey, setSelectedFlagKey } = useSelectedSeam();
  // Flags whose letter/refund was sent from this page this session: their cards stay with a SENT stamp.
  const [sentKeys, setSentKeys] = useState(() => new Set());
  const [drawer, setDrawer] = useState(null);

  // After any import or approval elsewhere in the app, refetch.
  useEffect(
    () =>
      onSeamsDataChanged(() => {
        reloadFlags();
        reloadRuled();
        reloadPatterns();
        reloadActions();
      }),
    [reloadFlags, reloadRuled, reloadPatterns, reloadActions],
  );

  const stages = useMemo(
    () => ({
      contracted: contracts.length > 0,
      shipped: shipments.length > 0,
      invoiced: invoices.length > 0,
      collected: invoices.some((r) => r.paid_date || String(r.status || "").toLowerCase() === "paid"),
    }),
    [contracts, shipments, invoices],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke("recordVisit", {});
        if (!cancelled) setVisit(data);
      } catch {
        /* visit tracking is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const live = useMemo(() => flags.filter((f) => TODAY_LIVE.has(f.status || "open")), [flags]);
  const totals = useMemo(() => totalsOf(live), [live]);

  const earliest = useMemo(() => {
    const dates = [
      ...shipments.map((r) => r.ship_date),
      ...invoices.map((r) => r.invoice_date),
      ...bills.map((r) => r.bill_date),
      ...returns.map((r) => r.return_date),
    ].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(String(d || "")));
    dates.sort();
    return dates[0] || null;
  }, [shipments, invoices, bills, returns]);

  // Biggest leak: seam with the most recoverable cents, then its largest rule inside that seam.
  const leak = useMemo(() => {
    const seams = Object.entries(totals.by_seam || {});
    if (!seams.length) return null;
    seams.sort((a, b) => b[1].cents - a[1].cents);
    const seam = seams[0][0];
    const inSeam = live.filter((f) => f.bucket === "recoverable" && f.seam === seam);
    const byRule = new Map();
    for (const f of inSeam) {
      if (!byRule.has(f.rule_id)) byRule.set(f.rule_id, []);
      byRule.get(f.rule_id).push(f);
    }
    const [ruleId, fs] = [...byRule.entries()].sort((a, b) => sumCents(b[1]) - sumCents(a[1]))[0];
    return { seam, ruleId, ruleName: fs[0]?.rule, n: fs.length, cents: sumCents(fs) };
  }, [totals, live]);

  // Root cause: the Pattern that explains the most invoices (Billing records), then the most money.
  const rootCause = useMemo(() => {
    if (!patterns.length) return null;
    const byKey = new Map(flags.map((f) => [f.stable_key, f]));
    const scored = patterns.map((p) => {
      const fs = (p.keys || []).map((k) => byKey.get(k)).filter(Boolean);
      const invoiceIds = new Set();
      for (const f of fs) for (const e of f.evidence || []) if (e.system === "Billing" && e.id) invoiceIds.add(e.id);
      return { pattern: p, invoices: invoiceIds.size, seam: mostCommon(fs.map((f) => f.seam)) };
    });
    scored.sort((a, b) => b.invoices - a.invoices || (b.pattern.amount_cents || 0) - (a.pattern.amount_cents || 0));
    return scored[0].invoices ? scored[0] : null;
  }, [patterns, flags]);

  // Tracker: recoverable flags by lifecycle status.
  const tracker = useMemo(() => {
    const rec = flags.filter((f) => f.bucket === "recoverable" && !TODAY_GONE.has(f.status || "open"));
    const pending = actions.filter((a) => a.status === "pending_second" && a.action_type === "send_letter");
    const drafted = rec.filter(
      (f) =>
        (f.status || "open") === "open" &&
        pending.some((a) => a.params?.party === f.party && !(a.params?.exclude_keys || []).includes(f.stable_key)),
    ).length;
    const sentFlags = rec.filter((f) => ["sent", "disputed", "recovered"].includes(f.status));
    const sentCents = sumCents(sentFlags);
    const recCents = sumCents(rec);
    return {
      found: rec.length,
      drafted,
      sent: rec.filter((f) => f.status === "sent" || f.status === "disputed").length,
      recovered: rec.filter((f) => f.status === "recovered").length,
      sentCents,
      pct: recCents ? Math.min(100, (sentCents / recCents) * 100) : 0,
    };
  }, [flags, actions]);

  // Look-alikes checked: ruled-out rows plus findings a person marked "not an issue".
  const lookAlikes = useMemo(
    () => ruled.length + flags.filter((f) => f.status === "dismissed").length,
    [ruled, flags],
  );

  // Cards: open flags in the selected seam (plus ones sent from here this session), largest first.
  const seamOpen = useMemo(
    () => flags.filter((f) => f.seam === selectedSeam && (f.status || "open") === "open"),
    [flags, selectedSeam],
  );
  const fixCards = useMemo(
    () =>
      flags
        .filter((f) => f.seam === selectedSeam && ((f.status || "open") === "open" || sentKeys.has(f.stable_key)))
        .sort((a, b) => (b.amount_cents || 0) - (a.amount_cents || 0)),
    [flags, selectedSeam, sentKeys],
  );

  // Default selected flag: the largest open flag in the seam.
  useEffect(() => {
    if (!fixCards.length) return;
    if (!fixCards.some((f) => f.stable_key === selectedFlagKey)) setSelectedFlagKey(fixCards[0].stable_key);
  }, [fixCards, selectedFlagKey, setSelectedFlagKey]);

  const selectedFlag = fixCards.find((f) => f.stable_key === selectedFlagKey) || null;
  const seamRootCause = useMemo(() => {
    const p = fixPatternFor(seamOpen, patterns);
    return p ? p.title : seamOpen[0]?.rule || null;
  }, [seamOpen, patterns]);
  const proofRootCause = useMemo(() => fixRootCause(selectedFlag, seamOpen, patterns), [selectedFlag, seamOpen, patterns]);

  const newKeys = useMemo(() => {
    const last = Date.parse(visit?.last_seen_at || "");
    if (!Number.isFinite(last)) return new Set();
    return new Set(
      flags.filter((f) => Date.parse(f.created_date || f.created_at || "") > last).map((f) => f.stable_key),
    );
  }, [flags, visit]);

  // Pending four-eyes sends, by party: flags in that send show NEEDS APPROVAL.
  const pendingByParty = useMemo(() => {
    const m = new Map();
    for (const a of actions) if (a.status === "pending_second" && a.action_type === "send_letter" && a.params?.party) m.set(a.params.party, a);
    return m;
  }, [actions]);

  const stamps = useMemo(() => {
    const m = new Map();
    for (const f of fixCards) {
      if (sentKeys.has(f.stable_key) && (f.status || "open") !== "open") m.set(f.stable_key, "sent");
      else {
        const a = pendingByParty.get(f.party);
        const kind = f.lane === "vendor" ? "vendor" : "customer";
        if (a && (a.params?.kind || "customer") === kind && !(a.params?.exclude_keys || []).includes(f.stable_key)) {
          m.set(f.stable_key, "approval");
        }
      }
    }
    return m;
  }, [fixCards, sentKeys, pendingByParty]);

  const selectFix = useCallback((f) => setSelectedFlagKey(f.stable_key), [setSelectedFlagKey]);

  const openFix = useCallback(
    (f) => {
      setSelectedFlagKey(f.stable_key);
      const kind = f.lane === "vendor" ? "vendor" : "customer";
      const a = pendingByParty.get(f.party);
      const pendingAction = a && (a.params?.kind || "customer") === kind ? a.id : null;
      setDrawer({ party: f.party, kind, lane: f.lane, pendingAction });
    },
    [pendingByParty, setSelectedFlagKey],
  );

  const onDrawerSent = useCallback((data) => {
    if (drawer && !data?.dismissed) {
      // Everything for this party in this lane that was open went out in the letter.
      const lane = drawer.kind === "vendor" ? "vendor" : "customer";
      const went = flags.filter((f) => f.party === drawer.party && (f.lane || "customer") === lane && (f.status || "open") === "open");
      setSentKeys((prev) => new Set([...prev, ...went.map((f) => f.stable_key)]));
    }
    setDrawer(null);
    announceSeamsDataChanged();
  }, [drawer, flags]);

  const dismissFix = useCallback(async (f, reason, startCollapse) => {
    await base44.functions.invoke("transitionFlag", { flag_id: f.id, to_status: "dismissed", reason });
    startCollapse();
    await new Promise((r) => setTimeout(r, FIX_COLLAPSE_MS));
    announceSeamsDataChanged();
  }, []);

  const showSince = Boolean(visit?.last_seen_at);
  const since = visit?.since || {};

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rise lg:col-span-4" aria-label="Morning brief">
        <p className="brief-label">Morning brief · computed from 4 systems</p>
        <h1 className="mt-3 font-display text-[36px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
          Northline leaked{" "}
          <span className="text-owed">{fmt(totals.recoverable.cents)}</span>
          {earliest ? ` since ${shortDate(earliest)}.` : "."}
        </h1>

        <p className="mt-4 text-[14px] leading-[1.7] text-ink">
          {leak ? (
            <>
              The biggest leak is{" "}
              <SeamPill seam={leak.seam} label={`Show seam ${seamLabel(leak.seam)}`}>
                {seamLabel(leak.seam)}
              </SeamPill>
              : {leak.n} {rulePhrase(leak.ruleId, leak.ruleName, leak.n)},{" "}
              <span className="money font-semibold">{fmt(leak.cents)}</span>.
            </>
          ) : (
            "No recoverable gaps are open."
          )}
          {rootCause ? (
            <>
              {" "}One root cause explains {rootCause.invoices} invoice{rootCause.invoices === 1 ? "" : "s"}:{" "}
              <SeamPill seam={rootCause.seam} label={`Show root cause ${rootCause.pattern.title}`}>
                {rootCause.pattern.title}
              </SeamPill>{" "}
              (<span className="money font-semibold">{fmt(rootCause.pattern.amount_cents || 0)}</span>).
            </>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip chip-overdue">
            Overdue <span className="money font-semibold">{fmt(totals.overdue.cents)}</span>
          </span>
          <span className="chip chip-credit">
            We owe customers <span className="money font-semibold">{fmt(totals.credit_owed.cents)}</span>
          </span>
          <span className="chip chip-neutral">{lookAlikes} look-alikes checked, 0 flagged</span>
        </div>

        {showSince ? (
          <p className="mt-3 text-[12px] text-muted" role="status">
            Since your last visit: +{since.new || 0} new, {since.cleared || 0} cleared
          </p>
        ) : null}

        <article className="card card-lift mt-4 px-4 py-3.5" aria-label="Fix tracker">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-medium text-ink">Fixes sent this session</p>
            <p className="money text-[13px] font-semibold text-ink">{fmt(tracker.sentCents)}</p>
          </div>
          <div
            className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-chip"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(tracker.pct)}
            aria-label="Share of recoverable money sent"
          >
            <div className="progress-fill h-full rounded-full bg-forest" style={{ width: `${tracker.pct}%` }} />
          </div>
          <p className="mt-2.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
            <span>Found {tracker.found}</span>
            <span aria-hidden>·</span>
            <span>Drafted {tracker.drafted}</span>
            <span aria-hidden>·</span>
            <span>Sent {tracker.sent}</span>
            <span aria-hidden>·</span>
            <span>Recovered {tracker.recovered}</span>
          </p>
        </article>
      </section>

      <WhereItSlipped flags={flags} ruledCount={lookAlikes} stages={stages} />

      {selectedSeam ? (
        <>
          <TodaysFixes
            seam={selectedSeam}
            cards={fixCards}
            rootCause={seamRootCause}
            selectedKey={selectedFlag?.stable_key || null}
            newKeys={newKeys}
            stamps={stamps}
            lookAlikes={lookAlikes}
            onSelect={selectFix}
            onAct={openFix}
            onDismiss={dismissFix}
          />
          <ProofTrace flag={selectedFlag} rootCause={proofRootCause} ruled={ruled} />
        </>
      ) : null}

      {drawer?.kind === "vendor" ? (
        <RefundDrawer
          party={drawer.party}
          role={role}
          pendingAction={drawer.pendingAction}
          onClose={() => setDrawer(null)}
          onSent={onDrawerSent}
          onPending={() => announceSeamsDataChanged()}
        />
      ) : drawer ? (
        <LetterDrawer
          party={drawer.party}
          kind="customer"
          role={role}
          pendingAction={drawer.pendingAction}
          onClose={() => setDrawer(null)}
          onSent={onDrawerSent}
          onPending={() => announceSeamsDataChanged()}
        />
      ) : null}
    </div>
  );
}
