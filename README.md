# Seams · Mind the gap

NYU × Base44 × Peri buildathon. Seams compares Northline's four systems, finds where they disagree, and settles each disagreement both ways, with proof.

| File | Use it for |
|---|---|
| `CURSOR_BUILD_PLAN.md` | **Tonight. The one plan Cursor follows:** setup, architecture, function contracts, every screen, milestones M0–M10 with prompts, tests and gates |
| `BASE44_TRANSFER.md` | **Tomorrow.** Moving into Base44 with the event credits (paths A/B/C) |
| `tools/PLAN.md` | Background spec (v3 decisions, security model). CURSOR_BUILD_PLAN.md wins on conflicts |
| `tools/data/` | Mock dataset, answer keys, `reference_checks.py` (source of truth) |

```bash
npm install && npm test && npm run dev    # then Data → Reset demo → Home shows $18,280.94
npm run transfer                          # builds ./transfer for Base44
```
Every number in the app comes from the dataset and opens its source records.
