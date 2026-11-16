---
name: Dev server quirks
description: Local Vite dev server behaviour that is easy to miss when verifying UI changes.
---
Changes to tailwind.config.js are not picked up by the running Vite dev server; new theme classes (e.g. a new color key) silently render unstyled until `npm run dev` is restarted.

**Why:** headline terracotta and progress bar were missing in a check until restart.
**How to apply:** restart the dev server after any Tailwind theme edit, before taking screenshots.
