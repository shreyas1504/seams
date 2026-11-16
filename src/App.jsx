// Seams shell: one header (brand, nav, search, upload, avatar menu) + page canvas. No sidebar.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { DEFAULT_SETTINGS } from "@/lib/engine/engine.js";
import Today from "./pages/Today.jsx";
import Home from "./pages/Home.jsx";
import Data from "./pages/Data.jsx";
import Ledger from "./pages/Ledger.jsx";
import Settings from "./pages/Settings.jsx";
import { SelectedSeamProvider } from "./context/SelectedSeam.jsx";
import { loadDemoData } from "./actions/loadDemoData.js";
import { shortDate } from "./components/systems.js";
import { setLocalUser } from "./lib/local/localBase44.js";

// Accounts and Activity show the previous Overview and Ledger pages until they are rebuilt.
const NAV = [
  { id: "Today", label: "Today" },
  { id: "Accounts", label: "Accounts" },
  { id: "Activity", label: "Activity" },
  { id: "Data", label: "Data" },
  { id: "Settings", label: "Settings" },
];

const USERS = {
  admin: { name: "Dana Controller", email: "dana@northline.example", roleLabel: "Controller" },
  user: { name: "Analyst", email: "analyst@northline.example", roleLabel: "Analyst" },
};

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Flag count with a "loaded" bit, so the empty state never flashes before the first list returns. */
function useFlagCount() {
  const [state, setState] = useState({ loaded: false, n: 0 });
  useEffect(() => {
    let alive = true;
    const load = () =>
      base44.entities.Flag.list(undefined, 5000).then((rows) => alive && setState({ loaded: true, n: rows.length }));
    load();
    const un = base44.entities.Flag.subscribe?.(() => load());
    return () => {
      alive = false;
      un && un();
    };
  }, []);
  return state;
}

function AvatarMenu({ role, onSwitchRole }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const u = USERS[role] || USERS.admin;

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
        {u.name.slice(0, 1)}
      </button>
      {open ? (
        <div className="card rise absolute right-0 top-[calc(100%+8px)] z-30 w-[240px] p-3 shadow-lift" role="menu">
          <p className="text-[13px] font-semibold text-ink">{u.name}</p>
          <p className="text-[11px] text-muted">{u.email}</p>
          <label className="mt-3 block text-[11px] font-medium text-muted">
            Role
            <select
              value={role}
              onChange={(e) => onSwitchRole(e.target.value)}
              className="mt-1 min-h-[36px] w-full rounded-[10px] border border-line bg-paper px-2 text-[13px] font-medium text-ink"
            >
              <option value="admin">Controller</option>
              <option value="user">Analyst</option>
            </select>
          </label>
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
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p className="font-display text-[30px] font-medium text-ink">Nothing loaded yet</p>
      <p className="mt-2 max-w-sm text-[13px] text-muted">
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
      {controllerOnly ? <p className="mt-2 text-[11px] font-medium text-overdue">Controller only</p> : null}
      {err ? (
        <p className="mt-2 text-[12px] font-medium text-overdue" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("Today");
  const [role, setRole] = useState("admin");
  const [lookupQ, setLookupQ] = useState("");
  const [lookupSignal, setLookupSignal] = useState(0);
  const [settings] = useEntity("Setting");
  const flagState = useFlagCount();
  const searchRef = useRef(null);

  const switchRole = (r) => {
    setRole(r);
    setLocalUser({ email: USERS[r].email, role: r });
  };

  const runHeaderSearch = (e) => {
    e.preventDefault();
    if (!lookupQ.trim()) return;
    setTab("Accounts");
    setLookupSignal((n) => n + 1);
  };

  const onKey = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const asOf = settings[0]?.as_of_date || DEFAULT_SETTINGS.as_of_date;

  let page;
  if (tab === "Today") {
    page = !flagState.loaded ? null : flagState.n ? <Today /> : <EmptyState role={role} />;
  } else if (tab === "Accounts") {
    page = (
      <Home
        role={role}
        headerLookup={lookupQ}
        headerLookupSignal={lookupSignal}
        onGoData={() => setTab("Data")}
      />
    );
  } else if (tab === "Activity") {
    page = <Ledger role={role} />;
  } else if (tab === "Settings") {
    page = <Settings role={role} />;
  } else {
    page = <Data role={role} />;
  }

  return (
    <SelectedSeamProvider>
      <div className="min-h-screen bg-paper text-ink">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
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
              <span className="font-display text-[19px] font-semibold leading-none text-ink">Seams</span>
            </button>
            <p className="hidden text-[12px] text-muted xl:block">
              Mind the gap · Northline Supply · as of {shortDate(asOf)}
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
              <form onSubmit={runHeaderSearch} className="relative hidden sm:block" role="search">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <SearchIcon />
                </span>
                <label htmlFor="global-search" className="sr-only">
                  Ask Seams or find a record
                </label>
                <input
                  id="global-search"
                  ref={searchRef}
                  value={lookupQ}
                  onChange={(e) => setLookupQ(e.target.value)}
                  placeholder="Ask Seams or find a record"
                  className="search-input"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                  ⌘K
                </kbd>
              </form>
              <button type="button" className="btn-forest" onClick={() => setTab("Data")}>
                Upload new data
              </button>
              <AvatarMenu role={role} onSwitchRole={switchRole} />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1280px] px-5 py-6 md:px-8 md:py-7">
          {page}
        </main>
      </div>
    </SelectedSeamProvider>
  );
}
