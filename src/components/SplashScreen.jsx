// Splash — CRMEdge-style lime mark.
import React, { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1400);
    const t2 = setTimeout(() => onDone?.(), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F7F7F8] transition-opacity duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C6F135]">
        <span className="text-2xl font-black text-[#111111]">S</span>
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#111111]">Seams</h1>
      <p className="mt-1 text-sm font-medium text-[#6B6B76]">Mind the gap</p>
      <div className="mt-8 h-1.5 w-36 overflow-hidden rounded-full bg-[#E8E8EC]">
        <div className="h-full w-2/3 rounded-full bg-[#C6F135]" />
      </div>
      <button type="button" onClick={() => onDone?.()} className="crm-btn-black mt-8">
        Enter overview
      </button>
    </div>
  );
}
