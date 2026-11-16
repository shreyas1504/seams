---
name: Dev server quirks
description: Local Vite dev server behaviour that is easy to miss when verifying UI changes.
---
Changes to tailwind.config.js are not picked up by the running Vite dev server; new theme classes (e.g. a new color key) silently render unstyled until `npm run dev` is restarted.

**Why:** headline terracotta and progress bar were missing in a check until restart.
**How to apply:** restart the dev server after any Tailwind theme edit, before taking screenshots.

When replacing the old background Vite server with a managed workflow, verify the public preview URL as well as the local server.

**Why:** workflow configuration retained the old port-80 mapping while adding a different port for the healthy server; local screenshots worked but the public preview returned 502.
**How to apply:** check which listener external port 80 actually forwards to. Remove stale mappings through the validated configuration flow rather than repeatedly restarting a healthy server.
