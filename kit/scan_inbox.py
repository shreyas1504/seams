"""Quick read of the emails that can change the rules: internal notes, Dana's replies,
supplier price or bank notices. Usage: python3 kit/scan_inbox.py DATA_DIR [since YYYY-MM-DD]"""
import sys, re, pandas as pd
d = sys.argv[1]; since = sys.argv[2] if len(sys.argv) > 2 else ""
ib = pd.read_csv(f"{d}/inbox.csv", dtype=str).fillna("")
if since: ib = ib[ib.sent_at >= since]
pat = r"approv|ok to|go ahead|waive|keep (them|the)|honou?r|exception|contract|price|tier|tax|exempt|bank|account|remit|routing|free deliver|fee|credit"
by_id = dict(zip(ib.message_id, ib.subject))
for r in ib.sort_values("sent_at").itertuples():
    internal = r.direction == "internal" or r.from_email.startswith("dana@")
    if r.mailbox.startswith("news") or "unsubscribe" in r.body.lower(): continue
    supplier_notice = r.direction == "inbound" and re.search(r"price update|bank|remit|account change|new account", r.subject, re.I)
    if internal or supplier_notice:
        print(f"{r.message_id} {r.sent_at} {r.direction:8} {r.from_email} | {r.subject}\n    {r.body[:600].replace(chr(10),' ')}\n")
