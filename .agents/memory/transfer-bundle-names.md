---
name: Transfer bundle top-level names
description: Base44 compact transfer bundle concatenates all src files; top-level names must be unique across files.
---
`npm run transfer` merges every file under src/ (except main.jsx and App.jsx) into one SeamsAll.jsx and strips local imports, so a top-level const/let/function/class name repeated in two files breaks it.

**Why:** the user's standing rule; Base44 paste flow uses that one-file bundle.
**How to apply:** use distinctive names in every new file (e.g. `SeamMapNodes`, not `NODES`; `TODAY_LIVE`, not `LIVE`). Run `npm run transfer` after adding files and confirm no duplicate-name error.
