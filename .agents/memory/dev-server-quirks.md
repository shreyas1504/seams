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

Keep the Vite default port consistent with the managed workflow, not just the workflow's command-line override.

**Why:** a later restart brought back the obsolete default-port forwarding rule even after a validated forwarding fix. Aligning the default and workflow kept the public URL reachable after restart.
**How to apply:** when changing a server port, align its config, workflow and public forwarding; verify the public URL after the restart.
