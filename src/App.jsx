// Seams shell: one header (brand, nav, search, upload, avatar menu) + page canvas. No sidebar.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntity } from "@/lib/useEntity";
import { DEFAULT_SETTINGS } from "@/lib/engine/engine.js";
import Today from "./pages/Today.jsx";
import Accounts from "./pages/Accounts.jsx";
import Data from "./pages/Data.jsx";
import Ledger from "./pages/Ledger.jsx";
import Settings from "./pages/Settings.jsx";
import { SelectedSeamProvider, useSelectedSeam } from "./context/SelectedSeam.jsx";
import { loadDemoData } from "./actions/loadDemoData.js";
import { shortDate } from "./components/systems.js";
import { setLocalUser } from "./lib/local/localBase44.js";
import InteractionFeedback, { SeamsSkeleton } from "./components/InteractionFeedback.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import SeamsSheet from "./components/SeamsSheet.jsx";

// Accounts and Activity show the previous Overview and Ledger pages until they are rebuilt.
const NAV = [
  { id: "Today", label: "Today" },
  { id: "Accounts", label: "Accounts" },
  { id: "Activity", label: "Activity" },
  { id: "Data", label: "Data" },
  { id: "Settings", label: "Settings" },
];

const USERS = {
  admin: { name: "Dana", email: "dana@northline.example", roleLabel: "Controller", role: "admin" },
  sam: { name: "Sam", email: "sam@northline.example", roleLabel: "Controller, second approver", role: "admin" },
  user: { name: "Alex", email: "alex@northline.example", roleLabel: "Analyst", role: "user" },
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
        {u.name}
      </button>
      {open ? (
        <div className="card rise absolute right-0 top-[calc(100%+8px)] z-30 w-[240px] p-3 shadow-lift" role="menu">
          <p className="text-[13px] font-semibold text-ink">{u.name}</p>
          <p className="text-[11px] text-muted">{u.email}</p>
          <label className="mt-3 block text-[11px] font-medium text-muted">
            Demo identity
            <select
              value={role}
              onChange={(e) => onSwitchRole(e.target.value)}
              className="mt-1 min-h-[36px] w-full rounded-[10px] border border-line bg-paper px-2 text-[13px] font-medium text-ink"
            >
              <option value="admin">Dana · Controller</option>
              <option value="sam">Sam · Controller, second approver</option>
              <option value="user">Alex · Analyst</option>
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

function SeamsAppShell() {
  const [tab, setTab] = useState("Today");
  const [identity, setIdentity] = useState("admin");
  const role = USERS[identity].role;
  const [palette, setPalette] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [twistNotice, setTwistNotice] = useState(null);
  const [twistNewKeys, setTwistNewKeys] = useState([]);
  const { setSelectedSeam, setSelectedFlagKey } = useSelectedSeam();
  const [settings] = useEntity("Setting");
  const flagState = useFlagCount();
  const searchRef = useRef(null);

  const switchRole = (r) => {
    setIdentity(r);
    setLocalUser({ email: USERS[r].email, role: USERS[r].role, full_name: USERS[r].name });
  };
  useEffect(() => { switchRole("admin"); }, []);

  const openFlag = (flag) => {
    setSelectedSeam(flag.seam); setSelectedFlagKey(flag.stable_key); setTab("Today");
  };
  const onTwistApproved = (data) => {
    setTwistNotice(data.checks?.counts || {new:0,cleared:0});
    setTwistNewKeys([...(data.dry?.new_recoverable||[]),...(data.dry?.new_credit||[])].map(f=>f.stable_key));
    setUploadOpen(false);setTab("Today");
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
    page = !flagState.loaded ? <SeamsSkeleton /> : flagState.n ? <Today role={role} notice={twistNotice} onDismissNotice={()=>setTwistNotice(null)} twistNewKeys={twistNewKeys} /> : <EmptyState role={role} />;
  } else if (tab === "Accounts") {
    page = <Accounts role={role} onOpenFlag={openFlag} />;
  } else if (tab === "Activity") {
    page = <Ledger role={role} />;
  } else if (tab === "Settings") {
    page = <Settings role={role} />;
  } else {
    page = <Data role={role} onApproved={onTwistApproved} />;
  }

  return (
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
              <div className="relative hidden sm:block" role="search">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <SearchIcon />
                </span>
                <label htmlFor="global-search" className="sr-only">
                  Ask Seams or find a record
                </label>
                <button
                  type="button"
                  id="global-search"
                  ref={searchRef}
                  onClick={()=>setPalette(true)}
                  className="search-input text-left"
                  aria-label="Ask Seams or find a record"
                >Ask Seams or find a record</button>
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                  ⌘K
                </kbd>
              </div>
              <button type="button" className="btn-forest" onClick={() => setUploadOpen(true)}>
                Upload new data
              </button>
              <AvatarMenu role={identity} onSwitchRole={switchRole} />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1280px] px-5 py-6 md:px-8 md:py-7">
          {page}
        </main>
        <InteractionFeedback />
        {uploadOpen ? <SeamsSheet title="Upload new data" eyebrow="Data stays in your systems" wide onClose={()=>setUploadOpen(false)}><Data role={role} onApproved={onTwistApproved}/></SeamsSheet> : null}
        {palette ? <CommandPalette role={role} onClose={()=>setPalette(false)} onNavigate={setTab} onUpload={()=>setUploadOpen(true)} /> : null}
      </div>
  );
}

export default function App() {
  return <SelectedSeamProvider><SeamsAppShell /></SelectedSeamProvider>;
}
