// Seams theme: every font, colour token and custom class in ONE component, so the look survives
// `npm run transfer` into Base44 (which does not copy index.css, index.html or tailwind.config.js).
// Edit styles HERE, not in a .css file. CSS variables are prefixed --s- so they never clash with shadcn.
import React from "react";

export const SEAMS_THEME_CSS = String.raw`@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");

/* ---- from src/index.css ---- */


:root {
  color-scheme: light;
  /* Seams warm-map tokens */
  --s-paper: #faf7f2;
  --s-card: #ffffff;
  --s-line: #ece4d8;
  --s-ink: #1c1917;
  --s-muted: #6b635a;
  --s-forest: #1f4d3a;
  --s-owed: #c2410c;
  --s-owed-fill: #e8a585;
  --s-overdue: #9f1239;
  --s-overdue-bg: #fbe8ec;
  --s-credit: #0f766e;
  --s-credit-bg: #e2f3ef;
  --s-chip: #f1ece4;
  --s-sys-crm-bg: #eaf1fd;
  --s-sys-crm-ink: #1e3a8a;
  --s-sys-wh-bg: #e3f4f6;
  --s-sys-wh-ink: #155e75;
  --s-sys-bill-bg: #ecf3e1;
  --s-sys-bill-ink: #3f6212;
  --s-sys-ap-bg: #f3edfb;
  --s-sys-ap-ink: #6b21a8;
  --s-sys-ret-bg: #fff4e5;
  --s-sys-ret-ink: #9a4a00;
  --s-radius-card: 16px;
  --s-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --s-font-display: "Figtree", system-ui, -apple-system, sans-serif;
  --s-font-ui: "Figtree", system-ui, -apple-system, sans-serif;
  --s-font-mono: "IBM Plex Mono", ui-monospace, monospace;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--s-paper);
  color: var(--s-ink);
  font-family: var(--s-font-ui);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  line-height: 1.45;
}

.font-display {
  font-family: var(--s-font-display);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.font-mono,
.font-mono *,
.money {
  font-family: var(--s-font-ui);
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 200;
  padding: 0.75rem 1rem;
  background: var(--s-forest);
  color: #fff;
  font-weight: 600;
  border-radius: 12px;
}
.skip-link:focus {
  left: 0.75rem;
  top: 0.75rem;
}

:focus-visible {
  outline: 2px solid var(--s-forest);
  outline-offset: 2px;
}

/* ---------- warm-map components ---------- */
.card,
.crm-card {
  background: var(--s-card);
  border-radius: var(--s-radius-card);
  border: 1px solid var(--s-line);
}

.card-lift {
  transition: transform 180ms var(--s-ease), box-shadow 180ms var(--s-ease);
}
.card-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px -12px rgba(28, 25, 23, 0.18);
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.rise {
  animation: rise-in 280ms var(--s-ease) both;
}

.progress-fill {
  transition: width 600ms var(--s-ease);
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--s-forest);
  color: #ffffff;
  font-family: var(--s-font-display);
  font-size: 15px;
  font-weight: 600;
}

.nav-link {
  min-height: 34px;
  padding: 0 0.75rem;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--s-muted);
  white-space: nowrap;
  transition: background 180ms var(--s-ease), color 180ms var(--s-ease);
}
.nav-link:hover {
  color: var(--s-ink);
  background: var(--s-chip);
}
.nav-link[aria-current="page"] {
  color: var(--s-ink);
  background: var(--s-card);
  box-shadow: inset 0 0 0 1px var(--s-line);
  font-weight: 600;
}

.search-input {
  min-height: 36px;
  width: 250px;
  transition: width 200ms var(--s-ease), box-shadow 200ms var(--s-ease);
  border-radius: 999px;
  border: 1px solid var(--s-line);
  background: var(--s-card);
  padding: 0 2.6rem 0 2.1rem;
  font-size: 12px;
  color: var(--s-ink);
}
.search-input::placeholder {
  color: var(--s-muted);
}
.search-input:focus {
  width: 300px;
  outline: none;
  border-color: var(--s-forest);
  box-shadow: 0 0 0 3px rgba(31, 77, 58, 0.12);
}

.btn-forest {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 1rem;
  border-radius: 999px;
  background: var(--s-forest);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: transform 180ms var(--s-ease), box-shadow 180ms var(--s-ease), background 180ms var(--s-ease);
}
.btn-forest:hover {
  background: #173d2e;
  transform: translateY(-1px);
}
.btn-forest:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--s-chip);
  border: 1px solid var(--s-line);
  color: var(--s-ink);
  font-size: 12px;
  font-weight: 600;
}

.brief-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--s-muted);
}

.seam-pill {
  display: inline;
  padding: 0.12rem 0.45rem;
  border-radius: 6px;
  font-weight: 500;
  white-space: nowrap;
  transition: box-shadow 180ms var(--s-ease), filter 180ms var(--s-ease);
}
.seam-pill:hover {
  filter: brightness(0.97);
}

/* ---------- Where it slipped ---------- */
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: #f4efe7;
}
.segmented-option {
  min-height: 30px;
  padding: 0 0.85rem;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--s-muted);
  transition: background 180ms var(--s-ease), color 180ms var(--s-ease), box-shadow 180ms var(--s-ease);
}
.segmented-option:hover {
  color: var(--s-ink);
}
.segmented-option[aria-pressed="true"] {
  background: #ffffff;
  color: var(--s-ink);
  box-shadow: 0 1px 2px rgba(28, 25, 23, 0.08);
}

.seam-conn {
  transition: opacity 220ms var(--s-ease);
}

@keyframes seam-drip-flow {
  to {
    stroke-dashoffset: -18;
  }
}
.seam-drip { animation: none; }
.seam-drip--on, .seam-conn:hover .seam-drip, .seam-conn:focus-visible .seam-drip { animation: seam-drip-flow 1.2s linear infinite; }
.seam-conn:focus-visible { outline: none; }
.seam-conn:focus-visible .seam-label-pill { stroke: #1F4D3A; stroke-width: 3; stroke-opacity: 1; }
@media (prefers-reduced-motion: reduce) { .seam-drip--on, .seam-conn:hover .seam-drip { animation: none; } }

.seam-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 32px;
  padding: 0 0.85rem;
  border-radius: 999px;
  border: 1px solid #e0d8cb;
  background: #ffffff;
  color: var(--s-ink);
  font-size: 12px;
  font-weight: 500;
  transition: background 180ms var(--s-ease), color 180ms var(--s-ease), border-color 180ms var(--s-ease);
}
.seam-chip:hover {
  border-color: var(--s-ink);
}
.seam-chip[aria-pressed="true"] {
  background: var(--s-ink);
  border-color: var(--s-ink);
  color: var(--s-paper);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 24px;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 11.5px;
}
.chip-overdue {
  background: var(--s-overdue-bg);
  color: var(--s-overdue);
}
.chip-credit {
  background: var(--s-credit-bg);
  color: var(--s-credit);
}
.chip-neutral {
  background: var(--s-chip);
  color: var(--s-muted);
}

.crm-btn-black {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 1.1rem;
  border-radius: 999px;
  background: #111111;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
}
.crm-btn-black:hover {
  background: #000;
}
.crm-btn-black:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.crm-btn-lime {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.1rem;
  border-radius: 999px;
  background: #c6f135;
  color: #2a3a00;
  font-size: 0.875rem;
  font-weight: 700;
}

.crm-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.7rem;
  font-weight: 700;
}
.crm-tag-ok {
  background: #e8f6d8;
  color: #3d5c12;
}
.crm-tag-warn {
  background: #ffe8d6;
  color: #8a4b12;
}
.crm-tag-leak {
  background: #fde8e6;
  color: #9b1c1c;
}
.crm-tag-credit {
  background: #e6f4ec;
  color: #17734b;
}

.crm-input {
  min-height: 44px;
  width: 100%;
  border-radius: 999px;
  border: 1px solid #e4e4e8;
  background: #ffffff;
  padding: 0 1rem 0 2.5rem;
  font-size: 0.875rem;
  color: #111;
}
.crm-input::placeholder {
  color: #6b6b76;
}

.crm-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  width: 100%;
  border-radius: 999px;
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b6b76;
  text-align: left;
}
.crm-nav-item:hover {
  background: #f0f0f2;
  color: #111;
}
.crm-nav-item[aria-current="page"] {
  background: #111111;
  color: #ffffff;
  font-weight: 600;
}

.gauge-ring {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin: 0 auto;
}

/* ---------- Today's fixes ---------- */
.fix-collapse {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 220ms var(--s-ease), opacity 220ms var(--s-ease);
}
.fix-collapse.is-collapsing {
  grid-template-rows: 0fr;
  opacity: 0;
}
.fix-collapse-inner {
  min-height: 0;
  padding-bottom: 10px;
}
.fix-collapse.is-collapsing .fix-collapse-inner {
  overflow: hidden;
}
.fix-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--s-line);
  background: var(--s-card);
  cursor: pointer;
  transition: background 180ms var(--s-ease), border-color 180ms var(--s-ease);
}
.fix-card:hover {
  border-color: #d6c9b6;
}
.fix-card.is-selected {
  background: #fffaf3;
  border-color: #cbb89c;
}
.fix-why {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fix-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: var(--s-ink);
  color: var(--s-paper);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 160ms var(--s-ease);
}
.fix-pill:hover {
  opacity: 0.88;
}
.fix-pill:disabled {
  opacity: 0.4;
}
.fix-quiet {
  font-size: 11.5px;
  color: #57534e;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: color 160ms var(--s-ease), text-decoration-color 160ms var(--s-ease);
}
.fix-quiet:hover {
  color: var(--s-ink);
  text-decoration-color: currentColor;
}
.fix-new {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--s-owed);
  color: var(--s-owed);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.fix-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 230px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--s-line);
  background: var(--s-card);
  box-shadow: 0 10px 28px -12px rgba(28, 25, 23, 0.25);
  cursor: default;
}
@keyframes fix-stamp-pop {
  0% {
    opacity: 0;
    transform: rotate(-6deg) scale(1.6);
  }
  70% {
    opacity: 1;
    transform: rotate(-6deg) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: rotate(-6deg) scale(1);
  }
}
.fix-stamp {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 2px solid currentColor;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  transform: rotate(-6deg);
  animation: fix-stamp-pop 240ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.fix-stamp-sent {
  color: #0f766e;
}
.fix-stamp-approval {
  color: #4338ca;
}

/* ---------- Proof · Trace ---------- */
.proof-dot {
  position: absolute;
  left: 2px;
  top: 3px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
}
.proof-line {
  position: absolute;
  left: 6px;
  top: 14px;
  bottom: -18px;
  width: 1px;
  background: #ece4d8;
}
.proof-record {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--s-line);
  background: #fcfaf6;
  min-width: 0;
}
.proof-record .proof-value {
  color: var(--s-ink);
  overflow-wrap: anywhere;
}
.proof-record.is-diff {
  background: #fdf1eb;
  border-color: #f0cdbd;
}
.proof-record.is-diff .proof-value {
  color: #9a3412;
}

.fade-on-clear {
  transition: opacity 200ms ease;
}
.fade-on-clear.is-cleared {
  opacity: 0;
}

/* Shared interaction states, including SVG keyboard targets. */
:where(button,a,input,select,textarea,[tabindex],[role="button"]):focus-visible {
  outline: 2px solid #1F4D3A;
  outline-offset: 2px;
}
button[class], .fix-card { transition: transform 90ms ease-out, background-color 90ms ease-out, border-color 90ms ease-out, opacity 90ms ease-out; }
button:active:not(:disabled), .fix-card:active { transform: scale(.98); }
.avatar { width: auto; min-width: 38px; padding: 0 10px; }
.fix-card { flex-wrap: wrap; }
.fix-card > .min-w-0 { min-width: 140px; }
.fix-card .fix-pill { white-space: normal; text-align: left; max-width: 100%; padding-top: 6px; padding-bottom: 6px; }
.seam-tooltip { transition: opacity 150ms ease; }
.seams-toast-region { position: fixed; left: 20px; bottom: 20px; z-index: 70; max-width: calc(100vw - 40px); }
.seams-toast { display: flex; align-items: center; gap: 16px; background: #0F766E; color: white; border-radius: 12px; padding: 14px 18px; box-shadow: 0 6px 24px #0002; font-size: 13px; }
.seams-toast button { text-decoration: underline; font-weight: 600; }
.seams-toast.is-error { background: #9F1239; }
.seams-shortcuts { position: fixed; z-index: 80; inset: 25% auto auto 50%; transform: translateX(-50%); width: min(360px,90vw); background: white; border: 1px solid #ECE4D8; padding: 24px; border-radius: 16px; box-shadow: 0 0 0 100vmax #1c191755; }
.seams-shortcuts p { margin-top: 10px; font-size: 13px; }
@keyframes seams-shimmer { to { background-position: -200% 0; } }
.seams-skeleton { border-radius: 14px; background: linear-gradient(90deg,#ECE4D8 25%,#F9F5EE 50%,#ECE4D8 75%); background-size: 200% 100%; animation: seams-shimmer 1.2s linear infinite; }
.seams-skeleton-grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px; }
@keyframes seams-spin { to { transform: rotate(360deg); } }
.seams-spinner { display: inline-block; height: 13px; width: 13px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; margin-right: 6px; animation: seams-spin .8s linear infinite; vertical-align: middle; }
@media (max-width: 640px) { .seams-skeleton-grid { grid-template-columns: 1fr; } .fix-card > div { max-width: 100%; } }
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
  .card-lift:hover,
  .btn-forest:hover {
    transform: none;
  }
}

/* ---- from src/components/settleSheets.css ---- */
.seams-settle-sheet {
  --s-settle-line: #e9e1d5;
  --s-settle-muted: #756d63;
  --s-settle-wash: #f5f0e8;
  --s-settle-green: #245b43;
  --s-settle-rust: #a94c2b;
  position: relative;
  isolation: isolate;
  background: var(--s-paper);
  color: var(--s-ink);
  animation: settle-sheet-in 240ms var(--s-ease) both;
}

.seams-settle-sheet::before {
  position: fixed;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  content: "";
  opacity: 0.17;
  background-image: radial-gradient(#8f7d65 0.42px, transparent 0.42px);
  background-size: 6px 6px;
}

.seams-settle-sheet__header {
  position: sticky;
  z-index: 3;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 22px 15px;
  border-bottom: 1px solid var(--s-settle-line);
  background: rgba(250, 247, 242, 0.96);
  backdrop-filter: blur(12px);
}

.seams-settle-sheet__eyebrow,
.seams-settle-sheet__label {
  color: var(--s-settle-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.seams-settle-sheet__title {
  margin: 2px 0 0;
  font-family: var(--s-font-display);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.seams-settle-sheet__close {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--s-settle-line);
  border-radius: 12px;
  background: #fffdf9;
  color: var(--s-ink);
  font-size: 19px;
  transition: transform 160ms var(--s-ease), background 160ms var(--s-ease);
}

.seams-settle-sheet__close:hover {
  transform: rotate(4deg);
  background: var(--s-settle-wash);
}

.seams-settle-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 17px 22px 24px;
}

.seams-settle-sheet__controls {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 15px;
}

.seams-settle-sheet__control-label {
  color: var(--s-settle-muted);
  font-size: 12px;
}

.seams-settle-sheet__control-value,
.seams-settle-sheet__input {
  min-width: 0;
  min-height: 34px;
  width: 100%;
  border: 1px solid var(--s-settle-line);
  border-radius: 9px;
  background: #fffdf9;
  padding: 6px 10px;
  color: var(--s-ink);
  font-size: 12px;
}

.seams-settle-sheet__control-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-color: transparent;
  background: transparent;
  padding-left: 0;
}

.seams-settle-sheet__locked {
  flex: none;
  color: var(--s-settle-muted);
  font-size: 10px;
  font-style: italic;
}

.seams-settle-sheet__input[readonly] {
  background: #f0ebe3;
  font-family: var(--s-font-mono);
  font-size: 11px;
}

.seams-settle-sheet__preview {
  padding: 17px 16px 14px;
  border: 1px solid var(--s-settle-line);
  border-radius: 13px;
  background: #fffdf9;
  box-shadow: 0 5px 18px rgba(63, 47, 29, 0.035);
}

.seams-settle-sheet__greeting,
.seams-settle-sheet__closing {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

.seams-settle-sheet__section {
  margin-top: 12px;
}

.seams-settle-sheet__section-title {
  margin: 0 0 5px;
  color: var(--s-settle-green);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.seams-settle-sheet__lines {
  display: grid;
  gap: 4px;
}

.seams-settle-sheet__line {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: start;
  gap: 7px;
  padding: 3px 0;
  font-size: 11px;
  line-height: 1.45;
}

.seams-settle-sheet__line input {
  width: 14px;
  height: 14px;
  margin: 1px 0 0;
  accent-color: var(--s-settle-green);
}

.seams-settle-sheet__line-copy {
  min-width: 0;
}

.seams-settle-sheet__line-amount {
  white-space: nowrap;
  color: var(--s-ink);
  font-family: var(--s-font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.seams-settle-sheet__closing {
  margin-top: 11px;
}

.seams-settle-sheet__fineprint {
  margin: 7px 0 0;
  color: var(--s-settle-muted);
  font-size: 10px;
}

.seams-settle-sheet__receipt-section {
  margin-top: 16px;
}

.seams-settle-sheet__receipt-title {
  margin: 0 0 6px;
  color: var(--s-settle-muted);
  font-size: 11px;
  font-weight: 600;
}

.seams-settle-sheet__receipt-wrap {
  overflow-x: auto;
  border: 1px solid var(--s-settle-line);
  border-radius: 10px;
  background: rgba(255, 253, 249, 0.8);
}

.seams-settle-sheet__receipt {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 10px;
}

.seams-settle-sheet__receipt th {
  padding: 7px 9px;
  background: #f1ece4;
  color: var(--s-settle-muted);
  font-weight: 500;
}

.seams-settle-sheet__receipt td {
  padding: 7px 9px;
  border-top: 1px solid var(--s-settle-line);
  vertical-align: top;
}

.seams-settle-sheet__receipt td:nth-child(2) {
  white-space: nowrap;
  font-family: var(--s-font-mono);
}

.seams-settle-sheet__receipt td:last-child {
  min-width: 120px;
  overflow-wrap: anywhere;
}

.seams-settle-sheet__footer {
  position: sticky;
  z-index: 2;
  bottom: 0;
  padding: 12px 22px 17px;
  border-top: 1px solid var(--s-settle-line);
  background: rgba(250, 247, 242, 0.97);
  box-shadow: 0 -8px 22px rgba(63, 47, 29, 0.035);
  backdrop-filter: blur(12px);
}

.seams-settle-sheet__total-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 9px;
}

.seams-settle-sheet__total {
  font-family: var(--s-font-mono);
  font-size: 21px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}

.seams-settle-sheet__actions {
  display: flex;
  gap: 8px;
}

.seams-settle-sheet__send {
  min-height: 42px;
  flex: 1;
  border-radius: 9px;
  background: var(--s-forest);
  color: #fffdf9;
  font-size: 12px;
  font-weight: 600;
  transition: transform 160ms var(--s-ease), background 160ms var(--s-ease);
}

.seams-settle-sheet__send:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #193f30;
}

.seams-settle-sheet__cancel,
.seams-settle-sheet__quiet {
  min-height: 42px;
  border: 1px solid var(--s-settle-line);
  border-radius: 9px;
  background: #fffdf9;
  padding: 0 13px;
  color: var(--s-ink);
  font-size: 11px;
}

.seams-settle-sheet__quiet {
  min-height: 32px;
  padding: 0 10px;
  color: var(--s-settle-muted);
}

.seams-settle-sheet__cancel:hover,
.seams-settle-sheet__quiet:hover {
  background: var(--s-settle-wash);
}

.seams-settle-sheet__send:disabled,
.seams-settle-sheet__cancel:disabled,
.seams-settle-sheet__quiet:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.seams-settle-sheet__footer-tools {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.seams-settle-sheet__status {
  min-height: 15px;
  margin: 7px 0 0;
  color: var(--s-settle-muted);
  font-size: 10px;
}

.seams-settle-sheet__error {
  margin: 0 0 7px;
  color: var(--s-settle-rust);
  font-size: 11px;
}

.seams-settle-sheet__approval {
  margin-bottom: 9px;
  padding: 9px 11px;
  border: 1px solid #dfd9ca;
  border-radius: 10px;
  background: #f3efe5;
  color: var(--s-ink);
  font-size: 11px;
}

.seams-settle-sheet__approval button {
  margin-top: 6px;
  border-bottom: 1px solid currentColor;
  font-weight: 600;
}

.seams-settle-sheet__loading {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  padding: 22px;
}

@keyframes settle-sheet-in {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (max-width: 520px) {
  .seams-settle-sheet__header { padding: 14px 16px 12px; }
  .seams-settle-sheet__body { padding: 14px 16px 20px; }
  .seams-settle-sheet__footer { padding: 10px 16px 13px; }
  .seams-settle-sheet__line { grid-template-columns: 16px minmax(0, 1fr); }
  .seams-settle-sheet__line-amount { grid-column: 2; }
}

@media (prefers-reduced-motion: reduce) {
  .seams-settle-sheet { animation: none; }
}

/* ---- from src/workspaceViews.css ---- */
/* Accounts, audit timeline, command palette and upload: existing warm tokens. */
.account-row { display:flex; align-items:center; gap:16px; text-align:left; width:100%; padding:18px 20px; }
.account-row:hover,.account-row:focus-visible { background:#F8F4ED; }
.account-initials { display:grid; place-items:center; flex-shrink:0; width:42px; height:42px; border-radius:50%; font-weight:600; font-size:14px; }
.account-name { flex:1; min-width:0; }
.account-name strong { display:block; font-size:14px; }
.account-name small { display:block; font-size:11px; color:var(--s-muted); margin-top:3px; }
.account-seam { display:inline-block; border-radius:5px; padding:2px 5px; font-size:10px; font-weight:500; }
.account-total { min-width:125px; text-align:right; font-size:17px; font-weight:500; }
.account-pending { color:#4338CA; background:#EEF0FD; }
.account-breakdown { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:15px; }
.account-breakdown p { color:var(--s-muted); font-size:11px; margin-bottom:3px; }
.account-breakdown strong { font-size:13px; }
.record-chip { display:inline-flex; align-items:center; border-radius:5px; padding:3px 6px; font-family:var(--s-font-mono); font-size:11px; color:#1F4D3A; background:#E9F0EC; }
.seams-sheet-overlay { position:fixed; inset:0; z-index:42; display:flex; justify-content:flex-end; background:#1c191744; }
.seams-sheet-backdrop { flex:1; min-width:0; }
.seams-sheet { display:flex; flex-direction:column; width:min(600px,100vw); height:100%; background:var(--s-paper); box-shadow:-10px 0 50px #1c191715; animation:seams-sheet-enter 220ms var(--s-ease); }
.seams-sheet.is-wide { width:min(700px,100vw); }
.seams-sheet-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:20px 24px; background:white; border-bottom:1px solid var(--s-line); flex-shrink:0; }
.sheet-close { display:grid; place-items:center; height:32px; width:32px; font-size:24px; line-height:1; border:1px solid var(--s-line); border-radius:8px; }
.seams-sheet-content { flex:1; overflow-y:auto; }
@keyframes seams-sheet-enter { from {transform:translateX(30px);opacity:0;} to {transform:none;opacity:1;} }
.mini-timeline li { position:relative; padding:0 0 18px 18px; border-left:1px solid var(--s-line); font-size:12px; }
.mini-timeline li:before { content:""; position:absolute; width:7px; height:7px; left:-4px; top:5px; border-radius:50%; background:var(--s-forest); }
.mini-timeline time { display:block; margin-top:4px; color:var(--s-muted); font-size:10px; }
.activity-timeline { margin-left:9px; border-left:1px solid var(--s-line); padding-left:25px; }
.activity-event { position:relative; margin-bottom:12px; }
.activity-event:before { content:""; position:absolute; top:24px; left:-30px; width:9px; height:9px; border-radius:50%; background:var(--s-forest); border:2px solid var(--s-paper); }
.activity-event .text-right { flex-shrink:0; }
.palette-overlay { position:fixed; inset:0; z-index:60; background:#1c191744; display:flex; justify-content:center; align-items:flex-start; padding:7vh 20px; backdrop-filter:blur(3px); }
.command-palette { display:flex; flex-direction:column; width:min(650px,100%); max-height:86vh; box-shadow:0 24px 90px #1c191733; overflow:hidden; animation:rise-in 180ms var(--s-ease); }
.palette-search { display:flex; align-items:center; gap:12px; padding:16px; border-bottom:1px solid var(--s-line); }
.palette-search input { flex:1; min-width:0; padding:6px; font-size:16px; background:transparent; border:0; }
.palette-results { padding:18px; overflow-y:auto; flex:1; }
.palette-record { display:block; width:100%; text-align:left; border-radius:8px; background:#F5F2EB; padding:10px; margin-top:5px; font-size:13px; }
.palette-action { display:flex; justify-content:space-between; width:100%; text-align:left; border-radius:7px; padding:9px 10px; font-size:13px; gap:12px; }
.palette-action:hover,.palette-action:focus-visible { background:#F4EFE7; }
.palette-action kbd { font-size:10px; color:var(--s-muted); }
.palette-footer { border-top:1px solid var(--s-line); padding:12px 18px; font-size:11px; color:var(--s-muted); }
.upload-workspace { padding:22px; }
.upload-file-heading { display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.upload-steps { display:flex; gap:6px; flex-wrap:wrap; margin:20px 0; font-size:11px; }
.upload-steps li { border-radius:999px; background:#F1ECE4; padding:6px 10px; color:var(--s-muted); }
.upload-steps .is-complete { background:#E2F3EF; color:#0F766E; }
.upload-mappings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.upload-mappings label { display:flex; gap:5px; align-items:center; font-size:11px; padding:8px; border:1px solid var(--s-line); background:white; border-radius:8px; min-width:0; }
.upload-mappings label span { max-width:45%; overflow-wrap:anywhere; }
.upload-workspace select { border:1px solid var(--s-line); background:white; padding:5px; border-radius:5px; max-width:100%; color:var(--s-ink); font-size:12px; }
.upload-mappings select { flex:1; min-width:0; font-size:11px; }
.upload-table-wrap { border:1px solid var(--s-line); border-radius:10px; overflow-x:auto; background:white; }
.upload-table { border-collapse:collapse; width:100%; text-align:left; font-size:11px; }
.upload-table th { background:#F4EFE7; color:var(--s-muted); font-weight:500; white-space:nowrap; padding:9px; }
.upload-table td { padding:9px; white-space:nowrap; border-top:1px solid var(--s-line); font-family:var(--s-font-mono); }
.upload-error { margin-top:12px; border:1px solid #EBC6CF; border-radius:8px; padding:10px; background:#FBE8EC; color:#9F1239; font-size:12px; }
.upload-log { font-size:10px; line-height:1.8; color:var(--s-muted); margin-top:18px; }
.twist-preview { margin-top:24px; padding-top:20px; border-top:1px solid var(--s-line); }
.twist-preview ul li { background:white; border:1px solid var(--s-line); border-radius:9px; padding:10px; }
.twist-preview ul li p { color:var(--s-muted); }
.twist-preview button { border-radius:999px; min-height:36px; font-size:12px; }
.twist-preview button:first-child { background:var(--s-ink); }
.twist-preview button:nth-child(2) { background:var(--s-forest); }
.twist-numbers { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; padding:15px; margin-top:16px; border:1px solid #D6DDD3; background:#F3F6F0; border-radius:10px; }
.twist-numbers strong { display:block; font-size:16px; font-weight:500; }
.twist-numbers small { display:block; color:var(--s-muted); font-size:10px; margin-top:5px; }
.twist-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 16px; background:#E9F0EC; border:1px solid #C6DACF; border-radius:10px; font-size:13px; color:var(--s-forest); }
.twist-banner button { font-size:22px; }
@media(max-width:640px) {
  .account-row { gap:9px; padding:14px 12px; flex-wrap:wrap; }
  .account-name { min-width:160px; }
  .account-total { min-width:auto; margin-left:auto; font-size:15px; }
  .upload-workspace { padding:16px; }
  .upload-mappings { grid-template-columns:1fr; }
  .twist-numbers { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .seams-sheet-header { padding:16px; }
}
@media(prefers-reduced-motion:reduce) {
  .seams-sheet,.command-palette { animation:none; }
}

/* ---- Run 7 additions ---- */
.seams-root { font-family: var(--s-font-ui); font-size: 13px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
.brief-headline { font-size: clamp(28px, 8vw, 36px); line-height: 1.12; letter-spacing: -0.01em; }
.fixes-heading { border-radius: 8px; transition: background-color 600ms var(--s-ease); }
.fixes-heading.flash { animation: seams-flash 900ms var(--s-ease); }
@keyframes seams-flash { 0% { background: #fde7d9; box-shadow: 0 0 0 6px #fde7d9; } 100% { background: transparent; box-shadow: 0 0 0 6px transparent; } }
.fix-cause { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 999px; background: var(--s-chip); color: #57534e; font-size: 10.5px; font-weight: 500; padding: 2px 8px; }
.fix-sub { font-size: 11px; color: var(--s-muted); text-align: right; }
.fix-approval-tag { color: var(--s-overdue); font-weight: 600; }
.chip-button { cursor: pointer; border: 0; }
.chip-button:hover { filter: brightness(0.97); }
.slip-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; color: #57534e; }
.slip-legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 999px; }
.legend-owed { background: #c2410c; }
.legend-late { background: #9f1239; }
.legend-credit { background: #0f766e; }
.record-link { color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; background: none; border: 0; padding: 0; }
.record-link:hover { color: var(--s-ink); text-decoration-style: solid; }
.ruled-reason { display: flex; gap: 8px; align-items: flex-start; }
.ruled-check { color: var(--s-credit); font-weight: 700; }
.seam-chip-chevron { display: none; }
.mobile-search { display: none; }
@media (max-width: 639px) {
  .slip-visual, .slip-legend { display: none; }
  .slip-rows { flex-direction: column; flex-wrap: nowrap; }
  .slip-rows .seam-chip { display: flex; width: 100%; min-height: 48px; border-radius: 12px; justify-content: flex-start; padding: 0 14px; font-size: 13px; }
  .slip-rows .seam-chip-name { font-weight: 600; flex: 1; text-align: left; }
  .slip-rows .seam-chip-sep { display: none; }
  .slip-rows .seam-chip-count { color: inherit; opacity: 0.7; margin-left: 10px; font-size: 12px; }
  .slip-rows .seam-chip-chevron { display: inline; margin-left: 8px; font-size: 18px; }
  .mobile-search { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--s-line); background: #fff; color: var(--s-ink); }
  .fix-card { flex-direction: column; }
}
.brief-progress { font-size: 12.5px; color: #57534e; }
.brief-progress .money { color: var(--s-ink); font-weight: 600; }
.settings-input { width: 100%; min-height: 42px; border-radius: 10px; border: 1px solid var(--s-line); background: #fff; padding: 0 12px; font: inherit; font-weight: 400; color: var(--s-ink); }
.settings-input:focus { outline: 2px solid var(--s-forest); outline-offset: 1px; }
.settings-input:disabled { background: var(--s-paper); color: var(--s-muted); }
.settings-check { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--s-line); background: #fff; cursor: pointer; }
.finding-chart { margin-top: 12px; border: 1px solid var(--s-line); border-radius: 12px; background: #fff; padding: 10px 12px 8px; }
.finding-chart__title { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--s-muted); margin-bottom: 4px; }
.finding-chart__caption { margin-top: 4px; font-size: 12px; color: #44403c; }
.cause-group { padding: 14px 16px; }
.cause-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.cause-title { font-size: 14px; font-weight: 600; color: var(--s-ink); }
.cause-meta { font-size: 12px; color: var(--s-muted); margin-top: 2px; }
.cause-rows { margin-top: 8px; border-top: 1px solid var(--s-line); }
.cause-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 10px; width: 100%; text-align: left; padding: 7px 4px; border-bottom: 1px solid #f3eee6; font-size: 12.5px; background: none; border-left: 0; border-right: 0; border-top: 0; cursor: pointer; }
.cause-row:hover { background: #fbf8f3; }
.cause-row[aria-pressed="true"] { background: #f6efe6; box-shadow: inset 3px 0 0 var(--s-owed); }
.cause-row-ids { font-family: var(--s-font-mono); font-size: 11.5px; color: #44403c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cause-row-party { color: var(--s-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cause-row-amt { font-weight: 600; }
.record-chip { border: 1px solid var(--s-line); background: #fff; border-radius: 8px; padding: 2px 8px; font-family: var(--s-font-mono); font-size: 11px; color: #44403c; cursor: pointer; }
.record-chip:hover { border-color: var(--s-ink); }
.evidence-list { display: grid; gap: 8px; list-style: none; padding: 0; }
.evidence-row { border: 1px solid var(--s-line); border-radius: 10px; padding: 8px 10px; background: #fff; }
.evidence-src { font-size: 11px; color: var(--s-muted); }
.evidence-file { font-family: var(--s-font-mono); color: #44403c; }
.evidence-shows { font-size: 13px; color: var(--s-ink); margin-top: 2px; }
.evidence-expected { font-size: 12px; color: var(--s-owed); margin-top: 2px; font-weight: 500; }
.fix-draft { width: 100%; border: 1px solid var(--s-line); border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 12.5px; line-height: 1.5; color: var(--s-ink); background: #fff; }
.ask-chip[aria-pressed="true"] { background: var(--s-ink); color: #fff; border-color: var(--s-ink); }
.ask-chip { border-radius: 999px; border: 1px solid var(--s-line); background: #fff; padding: 3px 10px; font-size: 11.5px; color: #44403c; cursor: pointer; }
`;

export default function SeamsTheme() {
  return <style data-seams-theme="">{SEAMS_THEME_CSS}</style>;
}
