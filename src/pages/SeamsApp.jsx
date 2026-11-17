// Seams app: the whole shell (header, nav, ⌘K, upload sheet, role menu, empty state, theme).
// Lives in pages/ so `npm run transfer` bundles it into SeamsAll.jsx. In Base44, route "/" to SeamsApp.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { DEFAULT_SETTINGS } from "@/lib/engine/engine.js";
import { SelectedSeamProvider, useSelectedSeam } from "@/context/SelectedSeam.jsx";
import { loadDemoData, DEMO_LOAD_FAILED } from "@/actions/loadDemoData.js";
import { onSeamsLookup, onSeamsDataChanged } from "@/actions/dataChanged.js";
import { shortDate } from "@/components/systems.js";
import InteractionFeedback, { SeamsSkeleton } from "@/components/InteractionFeedback.jsx";
import CommandPalette from "@/components/CommandPalette.jsx";
import SeamsSheet from "@/components/SeamsSheet.jsx";
import SeamsTheme from "@/components/SeamsTheme.jsx";
import KitToday from "@/pages/KitToday.jsx";
import KitData from "@/pages/KitData.jsx";
import KitDecisions from "@/pages/KitDecisions.jsx";
import KitIssues, { issOpenCause, issOpenRef } from "@/pages/KitIssues.jsx";
import KitMonday from "@/pages/KitMonday.jsx";

// Accounts and Activity show the previous Overview and Ledger pages until they are rebuilt.
// Kit mode: the app loads findings.csv + evidence.csv (from kit/detect.py) and keeps Decisions.
const NAV = [
  { id: "Today", label: "Today" },
  { id: "Issues", label: "Issues" },
  { id: "Monday", label: "Monday note" },
  { id: "Decisions", label: "Decisions" },
  { id: "Data", label: "Load findings" },
];

const USERS = {
  admin: { name: "Dana", email: "dana@northline.example", roleLabel: "Controller", role: "admin" },
  sam: { name: "Sam", email: "sam@northline.example", roleLabel: "Controller, second approver", role: "admin" },
  user: { name: "Alex", email: "alex@northline.example", roleLabel: "Analyst", role: "user" },
};

// Demo identities only work against the local stand-in (it reads the user from localStorage).
// In Base44 the real signed-in user decides the role, and four-eyes needs a second real account.
const SEAMS_USER_KEY = "seams:__user";
function seamsWriteDemoUser(u) {
  try {
    globalThis.localStorage?.setItem(SEAMS_USER_KEY, JSON.stringify(u));
  } catch {
    /* storage unavailable */
  }
}
async function seamsDetectLocal() {
  let local = false;
  try {
    const store = globalThis.localStorage;
    if (store) {
      const prev = store.getItem(SEAMS_USER_KEY);
      seamsWriteDemoUser({ email: "probe@seams.local", role: "admin", full_name: "Probe" });
      const probe = await base44.auth.me().catch(() => null);
      if (prev == null) store.removeItem(SEAMS_USER_KEY);
      else store.setItem(SEAMS_USER_KEY, prev);
      local = probe?.email === "probe@seams.local";
    }
  } catch {
    local = false; // storage blocked (sandboxed frame): treat as the real Base44 app
  }
  const me = local ? null : await base44.auth.me().catch(() => null);
  return { local, me };
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "Is anything loaded?" with a loaded bit, so the empty state never flashes before the first lists return.
 * Counts source records too: a clean real dataset with 0 findings must show Today ("Nothing slipped"), not the empty state.
 */
function useFlagCount() {
  const [state, setState] = useState({ loaded: false, n: 0 });
  useEffect(() => {
    let alive = true;
    const names = ["Flag", "Invoice", "Contract", "Shipment", "VendorBill"];
    const load = () =>
      Promise.all(names.map((n) => base44.entities[n].list(undefined, 1).catch(() => [])))
        .then((lists) => alive && setState({ loaded: true, n: lists.reduce((a, r) => a + (r || []).length, 0) }));
    load();
    const un = base44.entities.Flag.subscribe?.(() => load());
    const off = onSeamsDataChanged(() => load());
    return () => {
      alive = false;
      if (typeof un === "function") un();
      off();
    };
  }, []);
  return state;
}

function AvatarMenu({ role, onSwitchRole, realUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const u = realUser || USERS[role] || USERS.admin;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account: ${u.name}, ${u.roleLabel}`}
        onClick={() => setOpen((o) => !o)}
      >
        {u.name}
      </button>
      {open ? (
        <div className="card rise absolute right-0 top-[calc(100%+8px)] z-30 w-[240px] p-3 shadow-[0_10px_28px_-12px_rgba(28,25,23,0.18)]" role="menu">
          <p className="text-[13px] font-semibold text-[#1C1917]">{u.name}</p>
          <p className="text-[11px] text-[#6B635A]">{u.email}</p>
          {realUser ? (
            <p className="mt-2 text-[11px] font-medium text-[#6B635A]">{u.roleLabel}</p>
          ) : (
          <label className="mt-3 block text-[11px] font-medium text-[#6B635A]">
            Demo identity
            <select
              value={role}
              onChange={(e) => onSwitchRole(e.target.value)}
              className="mt-1 min-h-[36px] w-full rounded-[10px] border border-[#ECE4D8] bg-[#FAF7F2] px-2 text-[13px] font-medium text-[#1C1917]"
            >
              <option value="admin">Dana · Controller</option>
              <option value="sam">Sam · Controller, second approver</option>
              <option value="user">Alex · Analyst</option>
            </select>
          </label>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ role }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const controllerOnly = role !== "admin";

  const load = async () => {
    if (controllerOnly) return;
    setBusy(true);
    setErr("");
    try {
      await loadDemoData();
    } catch (e) {
      setErr(e?.message === DEMO_LOAD_FAILED ? DEMO_LOAD_FAILED + " In Base44, use Upload new data instead." : e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p className="font-display text-[30px] font-medium text-[#1C1917]">Nothing loaded yet</p>
      <p className="mt-2 max-w-sm text-[13px] text-[#6B635A]">
        Load the four Northline systems (CRM, Warehouse, Billing, AP) to see where money slipped.
      </p>
      <button
        type="button"
        className="btn-forest mt-5"
        onClick={load}
        disabled={busy || controllerOnly}
        title={controllerOnly ? "Controller only" : undefined}
      >
        {busy ? "Loading…" : "Load demo data"}
      </button>
      {controllerOnly ? <p className="mt-2 text-[11px] font-medium text-[#9F1239]">Controller only</p> : null}
      {err ? (
        <p className="mt-2 text-[12px] font-medium text-[#9F1239]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function SeamsAppShell() {
  const [tab, setTab] = useState("Today");
  const [identity, setIdentity] = useState("admin");
  const [realUser, setRealUser] = useState(null);
  const role = realUser ? realUser.role : USERS[identity].role;
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteAsk, setPaletteAsk] = useState(false);
  const [headerAsk, setHeaderAsk] = useState("");
  useEffect(() => onSeamsLookup((q, ask) => { setPaletteQuery(q); setPaletteAsk(ask); setPalette(true); }), []);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [twistNotice, setTwistNotice] = useState(null);
  const [twistNewKeys, setTwistNewKeys] = useState([]);
  const { setSelectedSeam, setSelectedFlagKey } = useSelectedSeam();
  const [settings] = useEntity("Setting");
  const flagState = useFlagCount();
  const searchRef = useRef(null);

  const switchRole = (r) => {
    setIdentity(r);
    seamsWriteDemoUser({ email: USERS[r].email, role: USERS[r].role, full_name: USERS[r].name });
  };
  useEffect(() => {
    seamsDetectLocal().then(({ local, me }) => {
      if (local) switchRole("admin");
      else {
        if (!me) { setRealUser({ name: "Signed out", email: "", role: "user", roleLabel: "Analyst" }); return; }
        const r = me.role === "admin" ? "admin" : "user";
        setRealUser({ name: me.full_name || me.email, email: me.email, role: r, roleLabel: r === "admin" ? "Controller" : "Analyst" });
      }
    });
  }, []);

  const openFlag = (flag) => {
    setSelectedSeam(flag.seam); setSelectedFlagKey(flag.stable_key); setTab("Today");
  };
  const onTwistApproved = (data) => {
    setTwistNotice(data.checks?.counts || {new:0,cleared:0});
    const fresh = [...(data.dry?.new_recoverable||[]),...(data.dry?.new_credit||[])];
    setTwistNewKeys(fresh.map(f=>f.stable_key));
    // Show the change: open the seam the new file created, largest new finding selected.
    const top = [...fresh].sort((a,b)=>(b.amount_cents||0)-(a.amount_cents||0))[0];
    if (top?.stable_key) {
      // The dry-run rows carry no seam; read it from the stored finding.
      base44.entities.Flag.filter({ stable_key: top.stable_key }).then((rows) => {
        const f = (rows || [])[0];
        if (f?.seam) { setSelectedSeam(f.seam); setSelectedFlagKey(f.stable_key); }
      }).catch(() => {});
    }
    setUploadOpen(false);setTab("Today");
    requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"smooth"}));
  };

  const onKey = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPalette(true);
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const asOf = settings[0]?.as_of_date || DEFAULT_SETTINGS.as_of_date;

  let page;
  if (tab === "Today") {
    page = <KitToday role={role} onGoData={() => setTab("Data")} onOpenIssue={(cause) => { issOpenCause(cause); setTab("Issues"); }} />;
  } else if (tab === "Monday") {
    page = <KitMonday onOpenIssue={(ref) => { issOpenRef(ref); setTab("Issues"); }} />;
  } else if (tab === "Issues") {
    page = <KitIssues role={role} />;
  } else if (tab === "Decisions") {
    page = <KitDecisions />;
  } else if (tab === "Data") {
    page = <KitData role={role} />;
  } else {
    page = <KitData role={role} />;
  }

  return (
      <div className="seams-root min-h-screen bg-[#FAF7F2] text-[#1C1917]">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <header className="sticky top-0 z-20 border-b border-[#ECE4D8] bg-[#FAF7F2]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 md:px-8">
            <button
              type="button"
              className="flex items-center gap-2.5 text-left"
              onClick={() => setTab("Today")}
              aria-label="Seams, go to Today"
            >
              <span className="brand-mark" aria-hidden>
                S
              </span>
              <span className="font-display text-[19px] font-semibold leading-none text-[#1C1917]">Seams</span>
            </button>
            <p className="text-[12px] text-[#6B635A] hidden 2xl:block">
              Mind the gap · Northline Supply
            </p>

            <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Primary">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="nav-link"
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              <div className="relative hidden sm:block" role="search">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B635A]">
                  <SearchIcon />
                </span>
                <label htmlFor="global-search" className="sr-only">
                  Ask Seams or find a record
                </label>
                <input
                  id="global-search"
                  ref={searchRef}
                  value={headerAsk}
                  onChange={(e) => setHeaderAsk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const q = headerAsk.trim();
                      if (q) { setPaletteQuery(q); setPaletteAsk(true); setPalette(true); setHeaderAsk(""); }
                      else setPalette(true);
                    }
                  }}
                  className="search-input"
                  placeholder="Ask Seams anything…"
                  aria-label="Ask Seams a question or find a record. Press Enter."
                  autoComplete="off"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#6B635A]">
                  ⌘K
                </kbd>
              </div>
              <button type="button" className="mobile-search" aria-label="Ask Seams or find a record" onClick={() => setPalette(true)}>
                <SearchIcon />
              </button>
              <button type="button" className="btn-forest" onClick={() => setUploadOpen(true)}>
                Load findings
              </button>
              <AvatarMenu role={identity} onSwitchRole={switchRole} realUser={realUser} />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1280px] px-5 py-6 md:px-8 md:py-7">
          {page}
        </main>
        <InteractionFeedback />
        {uploadOpen ? <SeamsSheet title="Load findings" eyebrow="findings.csv + evidence.csv · decisions kept" wide onClose={()=>setUploadOpen(false)}><KitData role={role} /></SeamsSheet> : null}
        {palette ? <CommandPalette key={paletteQuery + (paletteAsk ? ":ask" : "")} initialQuery={paletteQuery} autoAsk={paletteAsk} role={role} onClose={()=>{setPalette(false);setPaletteQuery("");setPaletteAsk(false);}} onNavigate={setTab} onUpload={()=>setUploadOpen(true)} /> : null}
      </div>
  );
}

export default function SeamsApp() {
  return (
    <SelectedSeamProvider>
      <SeamsTheme />
      <SeamsAppShell />
    </SelectedSeamProvider>
  );
}
