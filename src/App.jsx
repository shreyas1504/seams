// LOCAL shell: simple tabs + role switcher. In Base44, pages are routed by Base44 (src/pages/*.jsx); this file stays local.
import React, { useState } from "react";
import Home from "./pages/Home.jsx";
import Data from "./pages/Data.jsx";
import { setLocalUser } from "./lib/local/localBase44.js";

export default function App() {
  const [tab, setTab] = useState("Home");
  const [role, setRole] = useState("admin");
  const switchRole = (r) => { setRole(r); setLocalUser({ email: r === "admin" ? "dana@northline.example" : "analyst@northline.example", role: r }); };
  return (
    <div className="mx-auto max-w-6xl p-4">
      <nav className="mb-4 flex items-center gap-2 text-sm">
        {["Home", "Data"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 ${tab === t ? "bg-[#14171F] text-white" : "border border-[#E2DDD2]"}`}>{t}</button>
        ))}
        <span className="ml-auto text-[#5B5F68]">Local only · role:</span>
        <select value={role} onChange={(e) => switchRole(e.target.value)} className="rounded border border-[#E2DDD2] px-2 py-1">
          <option value="admin">Controller (admin)</option><option value="user">Analyst (user)</option>
        </select>
      </nav>
      {tab === "Home" ? <Home /> : <Data />}
    </div>
  );
}
