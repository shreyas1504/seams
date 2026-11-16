// Customer / correction letter drawer: sections, SideBySide, exclude toggles, receipt, send gate.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmt } from "@/lib/engine/engine.js";
import SideBySide from "@/components/SideBySide.jsx";

export default function LetterDrawer({ party, kind = "customer", role = "admin", cardNet, onClose, onSent }) {
  const [draft, setDraft] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [subject, setSubject] = useState("");
  const [tone, setTone] = useState("warm");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSecond, setPendingSecond] = useState(null);

  const load = async (excl = exclude, t = tone) => {
    setErr("");
    try {
      const { data } = await base44.functions.invoke("buildLetter", {
        party,
        kind,
        tone: t,
        exclude_keys: excl,
      });
      setDraft(data);
      setSubject(data.subject || "");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => { load([], "warm"); }, [party, kind]);

  const toggleKey = (key) => {
    if (key.startsWith("_")) return;
    const next = exclude.includes(key) ? exclude.filter((k) => k !== key) : [...exclude, key];
    setExclude(next);
    load(next, tone);
  };

  const send = async () => {
    if (role !== "admin") { setErr("Controller only"); return; }
    setBusy(true);
    setErr("");
    try {
      const { data } = await base44.functions.invoke("sendLetter", {
        party,
        kind,
        tone,
        exclude_keys: exclude,
        subject,
        total_cents: draft.total_cents,
      });
      if (data.pending_second) {
        setPendingSecond(data.pending_second);
      } else {
        onSent?.(data);
        onClose?.();
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (reason) => {
    setBusy(true);
    setErr("");
    try {
      const openFlags = (draft?.flag_keys || [])
        .map((k) => draft.sections.flatMap((s) => s.lines).find((l) => l.key === k)?.flag)
        .filter(Boolean);
      const flags = await base44.entities.Flag.filter({ party });
      for (const f of flags.filter((x) => x.status === "open" && (draft?.flag_keys || []).includes(x.stable_key))) {
        await base44.functions.invoke("transitionFlag", {
          flag_id: f.id,
          to_status: "dismissed",
          reason,
        });
      }
      void openFlags;
      onSent?.({ dismissed: true });
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
        <div className="h-full w-full max-w-lg bg-white p-6 text-sm text-[#5B5F68]">Building letter…</div>
      </div>
    );
  }

  const primary =
    draft.total_cents < 0
      ? `Send ${fmt(-draft.total_cents)} credit letter`
      : `Send ${fmt(draft.total_cents)} settlement`;
  const netOk = cardNet == null || cardNet === draft.total_cents;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-label="Letter">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#F6F3EC]">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DDD2] bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-[#14171F]">{party}</h2>
            <p className="text-xs text-[#5B5F68]">{kind} letter</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#F5F5F5]">✕</button>
        </div>

        <div className="space-y-4 p-4">
          <label className="block text-xs text-[#5B5F68]">
            To (from the contract)
            <input value={draft.to || ""} readOnly className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-[#F5F5F5] px-3 font-mono text-sm" />
          </label>
          <label className="block text-xs text-[#5B5F68]">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm" />
          </label>
          <label className="block text-xs text-[#5B5F68]">
            Tone
            <select
              value={tone}
              onChange={(e) => { setTone(e.target.value); load(exclude, e.target.value); }}
              className="mt-1 min-h-[44px] w-full rounded-2xl border border-[#E2DDD2] bg-white px-3 text-sm"
            >
              <option value="warm">Warm</option>
              <option value="firm">Firm</option>
              <option value="nudge">Nudge</option>
            </select>
          </label>

          <p className="text-sm text-[#14171F]">{draft.greeting}</p>

          {draft.sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 text-sm font-semibold text-[#14171F]">{sec.title}</h3>
              <ul className="space-y-3">
                {sec.lines.map((line) => (
                  <li key={line.key} className="rounded-2xl border border-[#E2DDD2] bg-white p-3">
                    <div className="flex items-start gap-2">
                      {line.key.startsWith("_") ? null : (
                        <input
                          type="checkbox"
                          checked={!exclude.includes(line.key)}
                          onChange={() => toggleKey(line.key)}
                          className="mt-1"
                          aria-label="Include line"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#14171F]">{line.text}</p>
                        {line.amount_cents ? (
                          <p className="mt-1 font-mono text-sm text-[#C22A25]">{fmt(line.signed_cents ?? line.amount_cents)}</p>
                        ) : null}
                        {line.flag ? <SideBySide flag={line.flag} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-sm text-[#14171F]">{draft.closing}</p>
          <p className="text-xs text-[#5B5F68]">{draft.footer}</p>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#14171F]">Receipt</h3>
            <div className="overflow-x-auto rounded-2xl border border-[#E2DDD2] bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="text-[#5B5F68]">
                  <tr>
                    <th className="px-2 py-1">System</th>
                    <th className="px-2 py-1">Id</th>
                    <th className="px-2 py-1">Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.receipt.map((r, i) => (
                    <tr key={i} className="border-t border-[#EFEFEF] font-mono">
                      <td className="px-2 py-1">{r.system}</td>
                      <td className="px-2 py-1">{r.id}</td>
                      <td className="px-2 py-1">{Object.entries(r.fields || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="font-mono text-xs text-[#14171F]">
            Letter total {fmt(draft.total_cents)}
            {cardNet != null ? ` = card net ${fmt(cardNet)}` : ""}
            {!netOk ? " · totals differ" : ""}
          </p>

          {pendingSecond ? (
            <p className="rounded-2xl bg-[#E8EEFF] px-3 py-2 text-xs text-[#3B5BDB]">
              Needs a second Controller approval (action {pendingSecond}).
            </p>
          ) : null}

          {err ? <p className="text-xs text-[#C22A25]">{err}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || role !== "admin" || !!pendingSecond}
              onClick={send}
              className="min-h-[44px] flex-1 rounded-2xl bg-[#000000] px-4 text-sm font-medium text-white disabled:opacity-40"
              title={role !== "admin" ? "Controller only" : undefined}
            >
              {role !== "admin" ? "Controller only" : primary}
            </button>
            <button type="button" disabled={busy} onClick={() => dismiss("Not a leak")} className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-3 text-xs">
              Not a leak
            </button>
            <button type="button" disabled={busy} onClick={() => dismiss("Already handled")} className="min-h-[44px] rounded-2xl border border-[#E2DDD2] bg-white px-3 text-xs">
              Already handled
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
