// CRMEdge-style shell: left sidebar + top search header + main canvas.
import React, { useCallback, useState } from "react";
import Home from "./pages/Home.jsx";
import Data from "./pages/Data.jsx";
import Ledger from "./pages/Ledger.jsx";
import Settings from "./pages/Settings.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { setLocalUser } from "./lib/local/localBase44.js";

const NAV = [
  { id: "Home", label: "Overview", icon: "▣" },
  { id: "Data", label: "Data", icon: "▦" },
  { id: "Ledger", label: "Ledger", icon: "☰" },
  { id: "Settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [splash, setSplash] = useState(() => {
    try {
      return sessionStorage.getItem("seams_splash_done") !== "1";
    } catch {
      return true;
    }
  });
  const [tab, setTab] = useState("Home");
  const [role, setRole] = useState("admin");
  const [lookupQ, setLookupQ] = useState("");
  const [lookupSignal, setLookupSignal] = useState(0);

  const finishSplash = useCallback(() => {
    try {
      sessionStorage.setItem("seams_splash_done", "1");
    } catch {
      /* ignore */
    }
    setSplash(false);
  }, []);

  const switchRole = (r) => {
    setRole(r);
    setLocalUser({
      email: r === "admin" ? "dana@northline.example" : "analyst@northline.example",
      role: r,
    });
  };

  const runHeaderSearch = (e) => {
    e.preventDefault();
    setTab("Home");
    setLookupSignal((n) => n + 1);
  };

  if (splash) return <SplashScreen onDone={finishSplash} />;

  const userLabel = role === "admin" ? "Dana Controller" : "Analyst";
  const userEmail = role === "admin" ? "dana@northline.example" : "analyst@northline.example";

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#111111]">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {/* Sidebar */}
        <aside
          className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-[#ECECEF] bg-[#F7F7F8] px-4 py-5 md:flex"
          aria-label="Primary"
        >
          <div className="mb-8 flex items-center gap-2.5 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C6F135] text-sm font-black text-[#111]">
              S
            </span>
            <div>
              <p className="text-base font-bold leading-none">Seams</p>
              <p className="text-[11px] font-medium text-[#6B6B76]">Mind the gap</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className="crm-nav-item"
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setTab(item.id)}
              >
                <span aria-hidden className="w-4 text-center">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-4 rounded-2xl border border-[#ECECEF] bg-white p-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111] text-xs font-bold text-white"
                aria-hidden
              >
                {userLabel.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{userLabel}</p>
                <p className="truncate text-[11px] text-[#6B6B76]">{userEmail}</p>
              </div>
            </div>
            <label className="mt-2 block text-[11px] font-semibold text-[#6B6B76]">
              Role
              <select
                value={role}
                onChange={(e) => switchRole(e.target.value)}
                className="mt-1 min-h-[40px] w-full rounded-xl border border-[#E4E4E8] bg-[#F7F7F8] px-2 text-sm font-semibold text-[#111]"
              >
                <option value="admin">Controller</option>
                <option value="user">Analyst</option>
              </select>
            </label>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[#ECECEF] bg-[#F7F7F8]/95 px-4 py-3 backdrop-blur md:px-6">
            <form onSubmit={runHeaderSearch} className="relative min-w-[200px] flex-1" role="search">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B76]" aria-hidden>
                ⌕
              </span>
              <label htmlFor="global-search" className="sr-only">
                Search records
              </label>
              <input
                id="global-search"
                value={lookupQ}
                onChange={(e) => setLookupQ(e.target.value)}
                placeholder="Search invoice, shipment, bill…"
                className="crm-input"
              />
            </form>
            <button
              type="button"
              className="crm-btn-black"
              onClick={() => setTab("Data")}
            >
              <span aria-hidden>+</span> Reset / import data
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E4E4E8] bg-white text-[#111]"
              aria-label="Notifications"
              title="Notifications"
            >
              ⌂
            </button>
          </header>

          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto border-b border-[#ECECEF] px-3 py-2 md:hidden" aria-label="Mobile">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`min-h-[40px] shrink-0 rounded-full px-3 text-xs font-semibold ${
                  tab === item.id ? "bg-[#111] text-white" : "bg-white text-[#6B6B76] border border-[#E4E4E8]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <main id="main" className="flex-1 px-4 py-5 md:px-6 md:py-6">
            {tab === "Home" ? (
              <Home
                role={role}
                headerLookup={lookupQ}
                headerLookupSignal={lookupSignal}
                onGoData={() => setTab("Data")}
              />
            ) : tab === "Ledger" ? (
              <Ledger role={role} />
            ) : tab === "Settings" ? (
              <Settings role={role} />
            ) : (
              <Data role={role} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
