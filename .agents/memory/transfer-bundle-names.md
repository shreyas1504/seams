---
name: Transfer bundle top-level names
description: Base44 compact transfer bundle concatenates all src files; top-level names must be unique across files.
---
`npm run transfer` concatenates every src/ file (except App.jsx/main.jsx) into one SeamsAll.jsx and strips local imports, so any top-level const/function name repeated in two files breaks it.

**Why:** Base44 paste flow uses that one-file bundle; a duplicate like `LIVE` in two pages fails the build step.
**How to apply:** prefix module-level constants in new pages/components (e.g. `TODAY_LIVE`). A pre-existing clash (`STEPS` in CustomerCard and DataFlowStrip) was still present as of Nov 2026.
