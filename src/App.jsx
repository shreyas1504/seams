// LOCAL shell: tabs + role switcher + bento chrome matching the product mock.
import React, { useState } from "react";
import Home from "./pages/Home.jsx";
import Data from "./pages/Data.jsx";
import Ledger from "./pages/Ledger.jsx";
import { setLocalUser } from "./lib/local/localBase44.js";

const NAV_TABS = [
  { id: "Home", label: "Home", icon: "⌂" },
  { id: "Data", label: "Data", icon: "▦" },
  { id: "Ledger", label: "Ledger", icon: "☰" },
];

export default function App() {
  const [tab, setTab] = useState("Home");
  const [role, setRole] = useState("admin");
  const switchRole = (r) => {
    setRole(r);
    setLocalUser({
      email: r === "admin" ? "dana@northline.example" : "analyst@northline.example",
      role: r,
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#14171F]">
      <div className="mx-auto flex max-w-6xl gap-4 p-4 pb-24 md:pb-4">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="mr-auto flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3B5BDB] text-sm font-semibold text-white">
                S
              </span>
              <div>
                <div className="text-sm font-semibold">Seams</div>
                <div className="text-xs text-[#5B5F68]">Mind the gap</div>
              </div>
            </div>
            <span className="text-xs text-[#5B5F68]">Local only · role</span>
            <select
              value={role}
              onChange={(e) => switchRole(e.target.value)}
              className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
            >
              <option value="admin">Controller (admin)</option>
              <option value="user">Analyst (user)</option>
            </select>
          </div>
          {tab === "Home" ? <Home role={role} /> : tab === "Ledger" ? <Ledger role={role} /> : <Data />}
        </div>

        <aside className="hidden w-16 shrink-0 md:flex md:flex-col md:items-center md:gap-3 md:pt-2">
          <div className="rounded-full bg-white px-3 py-2 font-mono text-sm shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
          <nav className="mt-auto flex flex-col items-center gap-3 rounded-[28px] bg-[#000000] p-2 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
            {NAV_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                  tab === t.id ? "bg-[#3B5BDB] text-white" : "text-[#B8B8B8] hover:text-white"
                }`}
              >
                {t.icon}
              </button>
            ))}
          </nav>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-center gap-2 border-t border-[#EAEAEA] bg-white/95 p-2 backdrop-blur md:hidden">
        {NAV_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] flex-1 rounded-2xl text-sm font-medium ${
              tab === t.id ? "bg-[#3B5BDB] text-white" : "bg-[#F5F5F5] text-[#14171F]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
