# Tomorrow: move Seams into Base44 (event credits)

You bring `transfer/` (from `npm run transfer` last night), the playbook, and the laptop with the local app running as a backup.

The order is: **data model → backend → golden numbers on mock data → screens → real data → twist.** Numbers before polish, always.

---

## 0. Kickoff checks (5 min, before typing anything)
- [ ] Does the event plan allow **backend functions**? → path B (default). If not → path C.
- [ ] Is **GitHub 2-way sync** available (Builder plan or higher)? → path A is possible, but only if setup takes less than 10 min.
- [ ] Can you **edit code files** in the Base44 editor (code view or cloud sandbox), or only prompt? Pasting files needs code edit; otherwise paste the code into the chat with "create this file exactly".
- [ ] Invite teammates and the demo email recipients as **app users**. SendEmail only reaches registered users.
- [ ] Set your own user to **admin** (Controller) and one teammate to **user** (Analyst).

---

## Fast route (use this first): the compact pack in `transfer/compact/`
Three pastes instead of ~40:
1. **ENTITIES_PROMPT.md** → paste the whole file into the Base44 builder chat as one prompt (creates all 13 entities). Verify the names.
2. **FUNCTIONS.md** → create each backend function listed, in order (runChecks first), pasting its code block. Test runChecks.
3. **SeamsAll.jsx** → create one page file `src/pages/SeamsAll.jsx` with the whole file, then prompt: "Route `/` to the exported `Home` component and `/data` to the exported `Data` component from src/pages/SeamsAll.jsx (and any other exported pages). Do not modify the file."
Then the golden-number check (B4 step 2–3) and real data (B6). Fall back to the per-file steps below only if a single big paste fails.

## Path B: paste and prompt (default)

### B1. Create the app (2 min)
New blank app called **Seams**. Settings: **Private** (sign-in required).

### B2. Entities (15 min)
For each file in `transfer/entities/` (13 files; Outbox is local-only and already excluded), in this order: Setting, Contract, Shipment, Invoice, VendorBill, Return, Flag, RuledOut, Pattern, Letter, SuggestedAction, AuditEvent, ColumnMapping.
- **With code edit:** create `base44/entities/<Name>.json` (or the entities folder the editor shows) and paste the file. The filename is the entity name and is case-sensitive.
- **Prompt only:** "Create an entity named `<Name>` with exactly this JSON schema, including the rls block. Do not add, rename or remove fields:" then paste the file.

Gate: every entity exists with exactly these names. Spot-check that Flag has `stable_key`, `amount_cents`, `status`.

### B3. Backend functions (20 min)
For each file in `transfer/functions/`, create a backend function with the **same name** (runChecks, importRows, resetDemo, plus every function built in CURSOR_BUILD_PLAN.md M2–M8) and paste the whole `.ts` file. The engine is already inside, and the import is already `npm:@base44/sdk`.
- Prompt-only fallback: "Create a backend function named `<name>` with exactly this code. Do not modify it:" then paste.

**Test runChecks first** (it carries the whole engine). Before any data, it should return `{ok:true, counts:{new:0,...}}`. A 401/403 means you're not signed in as admin.

### B4. Golden numbers on mock data (15 min) — do not skip
1. Paste `src/lib/csv.js`, `src/lib/engine/engine.js`, `src/lib/useEntity.js`, `src/components/SideBySide.jsx` and `src/pages/Data.jsx` from `transfer/frontend/src` (same paths). Make Data a page.
   - **Don't paste** `src/api/base44Client.js` or `src/lib/local/`. Base44 already has its own `@/api/base44Client`.
2. In Data: click **Reset demo**. Base44 won't serve `/seed/*.csv`, so if the log shows a fetch error, import the four files from `transfer/seed/` with the upload inputs (Contract, Shipment, Invoice, VendorBill).
3. Expected: `24 new flags · recoverable 17 · ruled out 13`.

Gate: Flag records total **$18,280.94** recoverable, **$13,977.99** overdue, **$180.00** credit_owed. If not, compare with the local app on the same seed before going further.

### B5. Screens (40 min)
Paste the remaining files from `transfer/frontend/src/` (pages and components). Then tell the builder:
> "Make Home.jsx the home page (/) and add routes for Data, Ledger and Settings. Use the files exactly as written; they already import `base44` from `@/api/base44Client`. Don't restyle; the Tailwind classes use literal hex colors on purpose."

If the builder rewrites a file, paste it again with "replace the file content exactly with this".

Gate: Home matches the local app on the mock data (hero, board, customer order, patterns, ruled-out 13).

### B6. Real data (30 min)
1. Data → Reset demo (clears mock data and findings; the AuditEvent log stays).
2. Import each real CSV through the mapper. Check rows parsed vs imported.
3. Settings: set the as-of date and thresholds to the case. Switch off any rule the case can't support.
4. Analyst: run Prompt 0 in Claude and/or `reference_checks.py` on the real files (columns renamed to canonical). Diff against the app. Fix the mapping or settings, never hard-code a number.
5. Update the demo numbers and the Ask Seams suggested questions to the real data.

### B7. Twist (when it lands)
Upload the new file → twist card → dry run → check the deltas with the analyst → Approve rule (or Revoke). If the file is a new kind the templates don't cover, run Prompt 0 on it and add a rule to engine.js locally, re-run `npm run transfer`, and re-paste only `runChecks.ts`.

### B8. Ship (10 min)
Publish · Security Scan clean · Analyst account can't send or edit Settings · demo run once from Reset.

---

## Path C: no backend functions on the event plan
1. Entities: as B2, but change the `rls` of Flag, RuledOut, Pattern, Letter, SuggestedAction and AuditEvent to `"create": {"user_condition": {"role": "admin"}}` and `"update"` the same. Without backend functions, the admin's browser does the writes.
2. Paste `transfer/engine.bundle.js` as `src/lib/engine/engine.js`, plus the frontend files.
3. Turn each function into a frontend helper: in each file from `transfer/functions/`, replace
   `const base44 = createClientFromRequest(req);` with `import { base44 } from "@/api/base44Client";` at the top,
   change `export default async function (req)` to `export async function runChecks(payload)`, read input from `payload` instead of `await req.json()`, and replace `base44.asServiceRole.entities` with `base44.entities`.
   Then call them directly instead of `base44.functions.invoke`. (Do this in Cursor last night if the kickoff check is likely to fail.)
4. Pitch change: say "next: server-side send gate". Don't claim it.

## Path A: GitHub sync available
Connect GitHub (Dashboard → GitHub → Connect → Create Repository), clone, `npm install`, `base44 login`, `base44 link`. Copy into the repo: `transfer/frontend/src/*` → `src/`, `transfer/functions/*` → the functions folder, `transfer/entities/*` → the entities folder. Run `base44 dev`, then merge to `main` and click **Publish**. Never run `base44 dev --remote` or the deploy/push CLI commands. Pull `main` before every push.

---

## Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| `Entity X not found` | Name or case mismatch | Entity names are case-sensitive: `VendorBill`, not `Vendorbill` |
| Function returns 401 | Not signed in | Sign in; functions check `base44.auth.me()` |
| Function returns 403 | User isn't admin | Set your user's role to admin |
| Totals differ from the local app | Mapping or settings differ | Same seed on both; compare Setting.rule_enabled and the as-of date |
| SendEmail error | Recipient isn't a registered app user | Invite them, or send to a teammate's app email for the demo |
| AI answers or mappings missing | InvokeLLM unavailable or rejected | Expected: every AI call falls back to templates or fuzzy matching |
| Builder rewrote a pasted file | Base44's AI "improved" it | Re-paste with "replace exactly"; keep a copy of transfer/ open |
| A list shows at most 5,000 rows | SDK list/filter limit | The case is far smaller; fine |
