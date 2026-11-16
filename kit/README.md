# Seams detector (Northline kit)

    python3 kit/detect.py kit/out data/september                 # September only
    python3 kit/detect.py kit/out data/september data/october    # both months (7 PM)

Transactions are appended across folders; master files come from the last folder.
Writes `kit/out/findings.csv` (submit this) and `kit/out/evidence.csv`. Load both in the app (Load findings):
Findings and Evidence are replaced, Decisions are kept (joined on `finding_id`, built from record IDs).
