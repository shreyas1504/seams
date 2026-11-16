// Today: morning brief + "Where it slipped" on top; "Today's fixes" + "Proof · Trace" below.
// Every sentence is a code template over engine numbers. No LLM text.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { totalsOf, fmt, buildLetterDraft, DEFAULT_SETTINGS } from "@/lib/engine/engine.js";
import { useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { seamLabel, seamTint, shortDate } from "@/components/systems.js";
import WhereItSlipped from "@/components/WhereItSlipped.jsx";
import TodaysFixes, { FIX_COLLAPSE_MS } from "@/components/TodaysFixes.jsx";
import ProofTrace from "@/components/ProofTrace.jsx";
import LetterDrawer from "@/components/LetterDrawer.jsx";
import RefundDrawer from "@/components/RefundDrawer.jsx";
import { fixPatternFor, fixRootCause } from "@/components/fixProof.js";
import { announceSeamsDataChanged } from "@/actions/dataChanged.js";
import { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import { fixCauseLabel, fixCausePattern, fixIsCausePattern } from "@/components/fixProof.js";

// Every number on Today (headline, chips, map, pills, root cause) counts OPEN flags only, so they always add up.
// Money already sent shows in the "Fixes sent" tracker instead.
const TODAY_SENT = new Set(["sent", "disputed", "recovered"]);

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

function SeamPill({ seam, children, label, className = "", onPicked }) {
  const { selectedSeam, setSelectedSeam } = useSelectedSeam();
  const tint = seamTint(seam);
  const active = selectedSeam === seam;
  const chip = Boolean(className);
  return (
    <button
      type="button"
      className={chip ? `${className} chip-button` : "seam-pill"}
      style={chip ? { boxShadow: active ? "inset 0 0 0 1.5px currentColor" : undefined } : { background: tint.bg, color: tint.ink, boxShadow: active ? `inset 0 0 0 1.5px ${tint.ink}` : undefined }}
      aria-pressed={active}
      aria-label={label}
      onClick={() => {
        setSelectedSeam(seam);
        onPicked?.();
      }}
    >
      {children}
    </button>
  );
}

/** "We owe customers" chip: opens the seam that holds the most credit we owe. */
function CreditChip({ flags, cents, onPicked }) {
  const bySeam = new Map();
  for (const f of flags) if (f.bucket === "credit_owed") bySeam.set(f.seam, (bySeam.get(f.seam) || 0) + (f.amount_cents || 0));
  const seam = [...bySeam.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!seam) return null;
  return (
    <SeamPill seam={seam} label={`Show credits we owe on ${seamLabel(seam)}`} className="chip chip-credit" onPicked={onPicked}>
      We owe customers <span className="money font-semibold">{fmt(cents)}</span>
    </SeamPill>
  );
}

export default function Today({ role = "admin", notice = null, onDismissNotice, twistNewKeys = [] }) {
  // One flag list feeds both the brief and the map, so they always update together.
  const [flags, , flagsMeta] = useEntity("Flag");
  const [ruled] = useEntity("RuledOut");
  const [patterns] = useEntity("Pattern");
  const [actions] = useEntity("SuggestedAction");
  const [fixSettings] = useEntity("Setting");
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

  // useEntity refetches every list on the app-wide data-changed event, so nothing here goes stale.

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

  const live = useMemo(() => flags.filter((f) => (f.status || "open") === "open"), [flags]);
  const totals = useMemo(() => totalsOf(live), [live]);
  const needsReview = useMemo(() => flags.filter((f) => f.status === "needs_review").length, [flags]);
  const systemCount = [contracts, shipments, invoices, bills, returns].filter((r) => r.length > 0).length;

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
    return { seam, seamCents: seams[0][1].cents, seamN: inSeam.length, ruleId, ruleName: fs[0]?.rule, n: fs.length, cents: sumCents(fs) };
  }, [totals, live]);

  // Root cause: the Pattern that explains the most invoices (Billing records), then the most money.
  const rootCause = useMemo(() => {
    if (!patterns.length) return null;
    const byKey = new Map(live.map((f) => [f.stable_key, f]));
    const scored = patterns.filter(fixIsCausePattern).map((p) => {
      const fs = (p.keys || []).map((k) => byKey.get(k)).filter(Boolean);
      const invoiceIds = new Set();
      for (const f of fs) for (const e of f.evidence || []) if (e.system === "Billing" && e.id) invoiceIds.add(e.id);
      return { pattern: p, invoices: invoiceIds.size, cents: sumCents(fs), seam: mostCommon(fs.map((f) => f.seam)) };
    });
    scored.sort((a, b) => b.invoices - a.invoices || b.cents - a.cents);
    return scored[0]?.invoices ? scored[0] : null;
  }, [patterns, live]);

  // Tracker: money we collect (recoverable + overdue). "Fixes sent" counts every sent line, so sending
  // Greenpoint's $2,830.00 letter ($1,360.00 billing fix + $1,470.00 overdue) shows $2,830.00.
  const tracker = useMemo(() => {
    const collect = flags.filter((f) => f.bucket !== "credit_owed" && ((f.status || "open") === "open" || TODAY_SENT.has(f.status)));
    const pending = actions.filter((a) => a.status === "pending_second" && a.action_type === "send_letter");
    const drafted = collect.filter(
      (f) =>
        (f.status || "open") === "open" &&
        pending.some((a) => a.params?.party === f.party && !(a.params?.exclude_keys || []).includes(f.stable_key)),
    ).length;
    const sentFlags = collect.filter((f) => TODAY_SENT.has(f.status));
    const recoveredFlags = collect.filter((f) => f.status === "recovered");
    const sentCents = sumCents(sentFlags);
    const allCents = sumCents(collect);
    return {
      found: collect.filter((f) => f.bucket === "recoverable").length,
      overdue: collect.filter((f) => f.bucket === "overdue").length,
      drafted,
      sent: sentFlags.length,
      recovered: recoveredFlags.length,
      sentCents,
      recoveredCents: sumCents(recoveredFlags),
      pct: allCents ? Math.min(100, (sentCents / allCents) * 100) : 0,
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
  // One action per customer account. The button never shows a different amount from its card:
  // single-item accounts say "Settle <party> · $X"; multi-item accounts open the letter and show the total underneath.
  const customerLabels = useMemo(() => {
    const labels = new Map();
    const settings = fixSettings[0] || {};
    const limit = settings.four_eyes_threshold_cents ?? DEFAULT_SETTINGS.four_eyes_threshold_cents;
    const rule_enabled = { ...DEFAULT_SETTINGS.rule_enabled, ...(settings.rule_enabled || {}) };
    for (const f of flags) {
      if (f.lane === "vendor" || labels.has(f.party)) continue;
      const draft = buildLetterDraft({ party: f.party, flags, contracts, rule_enabled });
      const items = flags.filter((x) => x.party === f.party && x.lane !== "vendor" && (x.status || "open") === "open").length;
      const approval = Math.abs(draft.total_cents) >= limit;
      labels.set(
        f.party,
        items > 1
          ? { label: `Open ${f.party} letter`, sub: `${items} items · ${fmt(draft.total_cents)}`, approval }
          : { label: approval ? `Send for second approval · ${fmt(draft.total_cents)}` : `Settle ${f.party} · ${fmt(draft.total_cents)}`, sub: "", approval },
      );
    }
    return labels;
  }, [flags, contracts, fixSettings]);

  // Default selected flag: the largest open flag in the seam.
  useEffect(() => {
    if (!fixCards.length) return;
    if (!flags.some((f) => f.stable_key === selectedFlagKey && f.seam === selectedSeam)) setSelectedFlagKey(fixCards[0].stable_key);
  }, [fixCards, flags, selectedSeam, selectedFlagKey, setSelectedFlagKey]);

  const selectedFlag = flags.find((f) => f.stable_key === selectedFlagKey && f.seam === selectedSeam) || null;
  // Seam summary: how many distinct causes the open cards have, e.g. "2 causes: invoice formatting (2), over PO (2)".
  const seamRootCause = useMemo(() => {
    if (selectedSeam === "Billing→Cash") return "Late, not lost: these invoices are billed correctly but unpaid.";
    const counts = new Map();
    for (const f of seamOpen) {
      const c = fixCauseLabel(f, seamOpen, patterns);
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    if (!counts.size) return null;
    const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`);
    return counts.size === 1 ? `Cause: ${parts[0]}` : `${counts.size} causes: ${parts.join(", ")}`;
  }, [seamOpen, patterns, selectedSeam]);
  // Cause tag on a card only when a pattern explains it; otherwise the card title already names the rule.
  const cardCauses = useMemo(
    () => new Map(fixCards.map((f) => [f.stable_key, fixCausePattern(f, seamOpen, patterns)?.title || null])),
    [fixCards, seamOpen, patterns],
  );
  const approvalLimit = fixSettings[0]?.four_eyes_threshold_cents ?? DEFAULT_SETTINGS.four_eyes_threshold_cents;
  const proofRootCause = useMemo(() => fixRootCause(selectedFlag, seamOpen, patterns), [selectedFlag, seamOpen, patterns]);

  const newKeys = useMemo(() => {
    const last = Date.parse(visit?.last_seen_at || "");
    if (!Number.isFinite(last)) return new Set(twistNewKeys);
    return new Set(
      [...twistNewKeys, ...flags.filter((f) => Date.parse(f.created_date || f.created_at || "") > last).map((f) => f.stable_key)],
    );
  }, [flags, visit, twistNewKeys]);

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

  // Picking a seam on the map scrolls Today's fixes into view and briefly highlights the heading.
  const scrollToFixes = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById("todays-fixes");
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 120 || r.top < 0) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    });
  }, []);

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
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input,textarea,select,[contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      const ordered = [...fixCards.filter((f) => f.bucket !== "credit_owed"), ...fixCards.filter((f) => f.bucket === "credit_owed")];
      const i = ordered.findIndex((f) => f.stable_key === selectedFlagKey);
      if (["j", "k"].includes(e.key.toLowerCase()) && ordered.length) {
        e.preventDefault();
        const next = ordered[Math.max(0, Math.min(ordered.length - 1, i + (e.key.toLowerCase() === "j" ? 1 : -1)))];
        setSelectedFlagKey(next.stable_key);
        document.querySelectorAll(".fix-card button[aria-pressed]")[ordered.indexOf(next)]?.focus();
      } else if (e.key === "Enter" && selectedFlag && (!e.target.closest?.("button,a") || e.target.matches?.(".fix-card button[aria-pressed]"))) {
        e.preventDefault();
        openFix(selectedFlag);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [fixCards, selectedFlagKey, selectedFlag, openFix, setSelectedFlagKey]);

  const onDrawerSent = useCallback(async (data) => {
    if (drawer && !data?.dismissed) {
      // Everything for this party in this lane that was open went out in the letter.
      const lane = drawer.kind === "vendor" ? "vendor" : "customer";
      const sentRows = await base44.entities.Flag.filter({ party: drawer.party });
      const went = sentRows.filter((f) => (f.lane || "customer") === lane && f.status === "sent");
      setSentKeys((prev) => new Set([...prev, ...went.map((f) => f.stable_key)]));
    }
    setDrawer(null);
    announceSeamsDataChanged();
  }, [drawer, flags]);

  const dismissFix = useCallback(async (f, reason, startCollapse) => {
    await base44.functions.invoke("transitionFlag", { flag_id: f.id, to_status: "dismissed", reason });
    startCollapse();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) await new Promise((r) => setTimeout(r, FIX_COLLAPSE_MS));
    announceSeamsDataChanged();
  }, []);

  const showSince = Boolean(visit?.last_seen_at);
  const since = visit?.since || {};

  if (!flagsMeta.loaded) return <SeamsSkeleton />;
  if (flagsMeta.error) {
    return (
      <div className="card px-5 py-8 text-center" role="alert">
        <p className="font-display text-[20px] text-[#1C1917]">Couldn't load findings.</p>
        <p className="mt-1 text-[13px] text-[#6B635A]">{flagsMeta.error}</p>
        <button type="button" className="btn-forest mt-4" onClick={() => announceSeamsDataChanged()}>Try again</button>
      </div>
    );
  }
  const nothingOpen = !live.length;
  const sinceText = earliest ? ` since ${shortDate(earliest)}` : "";
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {notice ? <div className="twist-banner lg:col-span-12" role="status"><p>New data in. {notice.new||0} new, {notice.cleared||0} cleared. Nothing rebuilt.</p><button aria-label="Dismiss new data banner" onClick={onDismissNotice}>×</button></div> : null}
      <section className="rise lg:col-span-4" aria-label="Morning brief">
        <p className="brief-label">Morning brief · computed from {systemCount} system{systemCount === 1 ? "" : "s"}</p>
        {nothingOpen ? (
          <h1 className="brief-headline mt-3 font-display font-medium text-[#1C1917]">Nothing slipped{sinceText}.</h1>
        ) : (
          <h1 className="brief-headline mt-3 font-display font-medium text-[#1C1917]">
            Northline leaked{" "}
            <span className="text-[#C2410C]">{fmt(totals.recoverable.cents)}</span>
            {sinceText}.
          </h1>
        )}

        <p className="mt-4 text-[14px] leading-[1.7] text-[#1C1917]">
          {leak ? (
            <>
              The biggest leak is{" "}
              <SeamPill seam={leak.seam} label={`Show seam ${seamLabel(leak.seam)}`} onPicked={scrollToFixes}>
                {seamLabel(leak.seam)}
              </SeamPill>{" "}
              (<span className="money font-semibold">{fmt(leak.seamCents)}</span>)
              {leak.n === leak.seamN ? (
                <>: {leak.n} {rulePhrase(leak.ruleId, leak.ruleName, leak.n)}.</>
              ) : (
                <>
                  , led by {leak.n} {rulePhrase(leak.ruleId, leak.ruleName, leak.n)} (
                  <span className="money font-semibold">{fmt(leak.cents)}</span>).
                </>
              )}
            </>
          ) : nothingOpen ? (
            `Every record across the ${systemCount} systems matched or was explained.`
          ) : (
            "No billing gaps are open; only late payments and credits remain."
          )}
          {rootCause ? (
            <>
              {" "}One root cause explains {rootCause.invoices} invoice{rootCause.invoices === 1 ? "" : "s"}:{" "}
              <SeamPill seam={rootCause.seam} label={`Show root cause ${rootCause.pattern.title}`} onPicked={scrollToFixes}>
                {rootCause.pattern.title}
              </SeamPill>{" "}
              (<span className="money font-semibold">{fmt(rootCause.cents)}</span>).
            </>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {totals.overdue.cents ? (
            <SeamPill seam="Billing→Cash" label="Show overdue invoices" className="chip chip-overdue" onPicked={scrollToFixes}>
              Overdue <span className="money font-semibold">{fmt(totals.overdue.cents)}</span>
            </SeamPill>
          ) : null}
          {totals.credit_owed.cents ? (
            <CreditChip flags={live} cents={totals.credit_owed.cents} onPicked={scrollToFixes} />
          ) : null}
          {needsReview ? <span className="chip chip-overdue">{needsReview} need{needsReview === 1 ? "s" : ""} review</span> : null}
          <span className="chip chip-neutral">{lookAlikes} look-alike{lookAlikes === 1 ? "" : "s"} ruled out with reasons</span>
        </div>

        {showSince ? (
          <p className="mt-3 text-[12px] text-[#6B635A]" role="status">
            Since your last visit: {since.new || 0} new, {since.cleared || 0} cleared
          </p>
        ) : null}

        <article className="card card-lift mt-4 px-4 py-3.5" aria-label="Fix tracker">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-medium text-[#1C1917]">Fixes sent</p>
            <p className="money text-[13px] font-semibold text-[#1C1917]">
              {fmt(tracker.sentCents)}
              <span className="ml-2 text-[11px] font-normal text-[#6B635A]">recovered {fmt(tracker.recoveredCents)}</span>
            </p>
          </div>
          <div
            className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-[#F1ECE4]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(tracker.pct)}
            aria-label="Share of money owed and overdue that has been sent"
          >
            <div className="progress-fill h-full rounded-full bg-[#1F4D3A]" style={{ width: `${tracker.pct}%` }} />
          </div>
          <p className="mt-2.5 flex flex-wrap gap-x-3 text-[11px] text-[#6B635A]">
            <span>Found {tracker.found} owed · {tracker.overdue} overdue</span>
            <span aria-hidden>·</span>
            <span>Drafted {tracker.drafted}</span>
            <span aria-hidden>·</span>
            <span>Sent {tracker.sent}</span>
            <span aria-hidden>·</span>
            <span>Recovered {tracker.recovered}</span>
          </p>
        </article>
      </section>

      <WhereItSlipped flags={flags} ruledCount={lookAlikes} stages={stages} onPicked={scrollToFixes} />

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
            customerLabels={customerLabels}
            causes={cardCauses}
            approvalLimit={approvalLimit}
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
