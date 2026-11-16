---
name: Today brief decisions (user-confirmed)
description: Template rules for the Today morning brief that the user explicitly approved; keep later runs consistent.
---
- Root cause = the Pattern explaining the most invoices (distinct Billing evidence ids), tiebreak by money. **Why:** top-by-money repeats the dup-payment lead sentence; user said "it's the right call".
- Root-cause pill shows the Pattern's own title verbatim.
- Biggest-leak sentence names the largest rule inside the top recoverable seam.
- "Since <date>" = earliest shipment/invoice/bill/return date; contract start dates excluded.
- Headline dollar figure in Fraunces; every other amount and record ID in IBM Plex Mono.
- Tracker counts recoverable flags only; Drafted = open flags covered by a pending_second letter.
- Accounts/Activity temporarily open old Overview/Ledger; user's Runs 5 and 6 replace them.
- Python module in .replit is harmless; ignore.
**How to apply:** don't revisit these unless the user changes them.

## Today's fixes (user review after Run 4, 2026-11-16)
- Keep "Approve as second Controller" in both drawers; a second Controller identity is coming in Run 5.
- Keep: dismissed ("Not an issue") findings count as look-alikes checked.
- Overdue math falling back to the rule name is acceptable; Run 5 rewords it.
- Fix in Run 5: credit_owed findings must not inflate a seam's card count vs its pill; put them in their own small labelled group.
- Fix in Run 5: customer card buttons must show the letter total, not the single flag amount.
**Why:** "one number everywhere" — any button or count must equal what actually gets sent or shown elsewhere.

## Sent-letter undo
Keep sent money letters irreversible. Undo must show “Send a correction instead”.

**Why:** the user confirmed that a sent money letter should not be reversible and that this is an honest answer for judges.
**How to apply:** preserve this behavior in later interaction changes; do not implement a reversal of a sent letter.
