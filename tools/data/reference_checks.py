"""Reference implementation of the Seams rules. Run: python3 reference_checks.py <folder> [--twist]
Reads the canonical-header CSVs (the clean/ folder) and prints every flag, every trap cleared, and totals.
Use it as the analyst's answer key: the Base44 app must match it exactly."""
import csv, re, sys
from collections import defaultdict
from datetime import date

folder = sys.argv[1] if len(sys.argv) > 1 else "clean"
TWIST = "--twist" in sys.argv
JSON_OUT = "--json" in sys.argv
AS_OF = date(2026, 11, 13)
OVERDUE_DAYS, PO_ABS, PO_PCT, WINDOW = 30, 25.0, 0.01, 10

def load(n): return list(csv.DictReader(open(f"{folder}/{n}.csv")))
D = date.fromisoformat
digits = lambda s: re.sub(r"\D", "", s or "")
keynorm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())

def norm_name(s):
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    words = [{"hosp": "hospital", "grp": "group", "mfg": "manufacturing", "constr": "construction"}.get(w, w) for w in s.split()]
    return " ".join(w for w in words if w not in {"inc", "llc", "corp", "group"})

contracts, ships, invs, ap = load("crm_contracts"), load("warehouse_shipments"), load("billing_invoices"), load("ap_bills")
returns = load("twist_returns_log") if TWIST else []

crm_by_norm = {norm_name(c["customer_name"]): c["customer_name"] for c in contracts}
def resolve(name):
    n = norm_name(name)
    if n in crm_by_norm: return crm_by_norm[n]
    raise SystemExit(f"UNMATCHED customer name: {name!r}")

def contract(cust, sku, d):
    for c in contracts:
        if c["customer_name"] == cust and c["sku"] == sku and D(c["start_date"]) <= d <= D(c["end_date"]):
            return c
    raise SystemExit(f"no contract {cust} {sku} {d}")

flags, traps = [], []
def flag(rule, seam, ids, party, amt, why, bucket="recoverable"):
    flags.append(dict(rule=rule, seam=seam, ids=ids, party=party, amount=round(amt, 2), why=why, bucket=bucket))

# --- join shipments <-> invoices ---
for s in ships: s["cust"] = resolve(s["ship_to"])
inv_by_order = defaultdict(list)
noref = []
for i in invs:
    (inv_by_order[digits(i["order_ref"])] if digits(i["order_ref"]) else noref).append(i)
for i in noref:
    cands = [s for s in ships if s["cust"] == i["customer"] and s["sku"] == i["sku"] and int(s["qty"]) == int(i["qty"])
             and abs((D(i["invoice_date"]) - D(s["ship_date"])).days) <= WINDOW and s["ship_type"] == "standard"]
    if len(cands) == 1:
        inv_by_order[digits(cands[0]["order_no"])].append(i)
        traps.append(("Shipped, not invoiced", f"{i['invoice_no']} has a blank order ref but matches {cands[0]['shipment_id']} on customer, SKU, qty and date"))
    else:
        print("NEEDS REVIEW (blank ref, not unique):", i["invoice_no"])
for s in ships:
    for i in inv_by_order.get(digits(s["order_no"]), []):
        if i["order_ref"] and i["order_ref"].strip().lower().startswith("so ") :
            traps.append(("Join", f"{i['invoice_no']} order ref '{i['order_ref']}' matches {s['order_no']} (digits-only match)"))
variants = sorted({s["ship_to"] for s in ships if s["ship_to"] != s["cust"]})
traps.append(("Join", "Warehouse names " + ", ".join(variants) + " resolve to CRM customers (normalized full name)"))

returned = defaultdict(int)
for r in returns:
    if r["return_id"] not in [x for x in []]: pass
seen_ret = set()
for r in returns:
    if r["return_id"] in seen_ret: continue
    seen_ret.add(r["return_id"]); returned[(digits(r["order_ref"]), r["sku"])] += int(r["qty_returned"])

for s in ships:
    cust, sku, qty, sd = s["cust"], s["sku"], int(s["qty"]), D(s["ship_date"])
    c = contract(cust, sku, sd); price = float(c["contract_price"]); rebill = c["rebill_freight"] == "Y"
    fc = float(s["freight_cost"])
    if s["ship_type"] != "standard":
        traps.append(("Shipped, not invoiced", f"{s['shipment_id']} is a {s['ship_type']} shipment, not billable")); continue
    linv = inv_by_order.get(digits(s["order_no"]), [])
    if not linv:
        amt = qty * price + (fc if rebill else 0)
        flag("Shipped, not invoiced", "Warehouse to Billing", [s["shipment_id"]], cust, amt,
             f"{qty} x {price:.2f}" + (f" + freight {fc:.2f}" if rebill else "")); continue
    billed_q = sum(int(i["qty"]) for i in linv)
    if len(linv) > 1 and billed_q == qty:
        traps.append(("Short-billed", f"{s['order_no']} invoiced in {len(linv)} parts ({'+'.join(i['qty'] for i in linv)}) = {qty}"))
    ret = returned[(digits(s["order_no"]), sku)]
    if billed_q < qty - ret:
        miss = qty - ret - billed_q
        flag("Short-billed", "Warehouse to Billing", [s["shipment_id"]] + [i["invoice_no"] for i in linv], cust, miss * price,
             f"shipped {qty}, returned {ret}, invoiced {billed_q}: {miss} x {price:.2f}")
    elif ret and billed_q == qty - ret:
        traps.append(("Short-billed", f"{s['order_no']}: {ret} units returned explain the gap (cleared by twist)"))
    fb = sum(float(i["freight_billed"]) for i in linv)
    if rebill and fc - fb > 0.005:
        flag("Freight not rebilled", "Warehouse to Billing", [s["shipment_id"]] + [linv[0]["invoice_no"]], cust, fc - fb,
             f"freight cost {fc:.2f} - billed {fb:.2f}")
    if not rebill and fc > 0:
        traps.append(("Freight not rebilled", f"{s['shipment_id']} freight {fc:.2f} not billed, but {cust} contract does not rebill freight"))

for i in invs:
    idt = D(i["invoice_date"]); c = contract(i["customer"], i["sku"], idt); cp = float(c["contract_price"]); up = float(i["unit_price"])
    if up < cp - 0.005:
        flag("Below contract price", "CRM to Billing", [i["invoice_no"], c["contract_id"]], i["customer"], (cp - up) * int(i["qty"]),
             f"({cp:.2f} - {up:.2f}) x {i['qty']}")
    elif up > cp + 0.005:
        flag("Billed above contract (credit we owe)", "CRM to Billing", [i["invoice_no"], c["contract_id"]], i["customer"], (up - cp) * int(i["qty"]),
             f"({up:.2f} - {cp:.2f}) x {i['qty']}", bucket="credit_owed")
    elif i["sku"] == "GLV-NIT-100" and up == 21.00 and idt <= date(2026, 9, 21):
        traps.append(("Billed above contract", f"{i['invoice_no']} billed 21.00 on {i['invoice_date']} for goods shipped earlier: invoice-date price applies, not overbilled"))
    elif i["sku"] == "GLV-NIT-100" and up == 18.50:
        traps.append(("Below contract price", f"{i['invoice_no']} billed 18.50 on {i['invoice_date']}, before the 9/15 increase: correct"))
    if i["status"] == "open":
        late = (AS_OF - D(i["due_date"])).days
        if late >= OVERDUE_DAYS:
            flag("Overdue receivable", "Billing to Customer", [i["invoice_no"]], i["customer"], float(i["amount"]),
                 f"open, {late} days past due", bucket="overdue")
        elif late > 0:
            traps.append(("Overdue receivable", f"{i['invoice_no']} only {late} days late"))

groups = defaultdict(list)
for bl in ap: groups[(bl["vendor"], keynorm(bl["vendor_invoice_no"]))].append(bl)
for (v, k), bills in groups.items():
    for extra in bills[1:]:
        flag("Duplicate vendor payment", "AP to Vendors", [b["bill_id"] for b in bills], v, float(extra["amount"]),
             f"invoice {bills[0]['vendor_invoice_no']} / {extra['vendor_invoice_no']} paid twice", bucket="recoverable")
by_vendor_amt = defaultdict(set)
for bl in ap: by_vendor_amt[(bl["vendor"], bl["amount"])].add(keynorm(bl["vendor_invoice_no"]))
for (v, a), ks in by_vendor_amt.items():
    if len(ks) > 1:
        traps.append(("Duplicate vendor payment", f"{v}: {len(ks)} bills of {a}, different invoice numbers (recurring)"))
seen = set()
for bl in ap:
    k = (bl["vendor"], keynorm(bl["vendor_invoice_no"]))
    if k in seen or not bl["po_amount"]: seen.add(k); continue
    seen.add(k)
    a, po = float(bl["amount"]), float(bl["po_amount"]); diff = a - po
    if diff > max(PO_ABS, PO_PCT * po):
        flag("Vendor over PO", "AP to Vendors", [bl["bill_id"], bl["po_no"]], bl["vendor"], diff, f"{a:.2f} - PO {po:.2f}")
    elif diff > 0:
        traps.append(("Vendor over PO", f"{bl['bill_id']} is {diff:.2f} over PO, under the max(25, 1%) tolerance"))

if TWIST:
    inv_price = {}
    for s_ in ships:
        for i in inv_by_order.get(digits(s_["order_no"]), []): inv_price[(digits(s_["order_no"]), s_["sku"])] = float(i["unit_price"])
    credited = defaultdict(float); seen_cm = set()
    for r in returns:
        k = keynorm(r["credit_memo_no"])
        if k and k not in seen_cm:
            seen_cm.add(k); credited[(digits(r["order_ref"]), r["sku"])] += float(r["credit_amount"])
    for s_ in ships:
        key = (digits(s_["order_no"]), s_["sku"]); ret = returned[key]
        if not ret: continue
        linv = inv_by_order.get(key[0], [])
        billed = sum(int(i["qty"]) for i in linv)
        excess = billed - (int(s_["qty"]) - ret)
        if excess <= 0: continue
        due = round(excess * inv_price[key] - credited[key], 2)
        if due > 0.005:
            flag("Credit never issued (return)", "Returns to Billing", [s_["shipment_id"]] + [r["return_id"] for r in returns if digits(r["order_ref"]) == key[0]],
                 s_["cust"], due, f"{excess} returned units billed at {inv_price[key]:.2f}, credits issued {credited[key]:.2f}", bucket="credit_owed")
        else:
            traps.append(("Credit never issued", f"{s_['order_no']}: {excess} returned units already credited ({credited[key]:.2f})"))
    cm = defaultdict(list)
    for r in returns:
        if r["credit_memo_no"]: cm[keynorm(r["credit_memo_no"])].append(r)
    for k, rs in cm.items():
        for extra in rs[1:]:
            flag("Duplicate credit memo (over-credit)", "Billing to Customer", [r["return_id"] + "/" + r["credit_memo_no"] for r in rs],
                 rs[0]["customer"], float(extra["credit_amount"]), f"credit memo {rs[0]['credit_memo_no']} applied twice")

# ---- patterns (rule-computed, >= 3 flags sharing a cause) ----
patterns = []
gl = [f for f in flags if f["rule"] == "Below contract price" and "21.00 - 18.50" in f["why"]]
if len(gl) >= 3:
    patterns.append(f"Glove price not updated after 9/15: {len(gl)} invoices, {len({f['party'] for f in gl})} customers, {sum(f['amount'] for f in gl):,.2f}")
by_party = defaultdict(list)
for f in flags:
    if f["bucket"] == "recoverable" and f["lane"] if "lane" in f else f["bucket"] == "recoverable": by_party[f["party"]].append(f)
for p_, fs in by_party.items():
    if len(fs) >= 3 and p_ not in ("Hudson Paper Co", "Atlas Packaging"):
        patterns.append(f"{p_}: {len(fs)} recoverable issues across {len({f['rule'] for f in fs})} rules, {sum(f['amount'] for f in fs):,.2f}")
fr = [f for f in flags if f["rule"] == "Freight not rebilled"]
if len(fr) >= 3:
    patterns.append(f"Freight not passed on to rebill customers: {len(fr)} shipments, {len({f['party'] for f in fr})} customers, {sum(f['amount'] for f in fr):,.2f}")
dp = [f for f in flags if f["rule"] == "Duplicate vendor payment"]
if len(dp) >= 2:
    patterns.append(f"Duplicate payments differ only by invoice-number formatting: {len(dp)} vendors, {sum(f['amount'] for f in dp):,.2f}")

# ---- report ----
if JSON_OUT:
    import json
    print(json.dumps({"flags": [{"rule": f["rule"], "party": f["party"], "amount_cents": round(f["amount"]*100), "bucket": f["bucket"], "ids": sorted(f["ids"])} for f in flags],
                      "ruled_out": len(traps), "patterns": patterns}, indent=1)); sys.exit(0)
rec = [f for f in flags if f["bucket"] == "recoverable"]; od = [f for f in flags if f["bucket"] == "overdue"]
by_rule = defaultdict(lambda: [0, 0.0])
for f in flags: by_rule[f["rule"]][0] += 1; by_rule[f["rule"]][1] += f["amount"]
print(f"== {folder} {'(after twist)' if TWIST else ''} as of {AS_OF}")
for f in sorted(flags, key=lambda f: -f["amount"]):
    print(f"  {f['rule']:<36} {f['party']:<24} {f['amount']:>10.2f}  {'/'.join(f['ids'])}  [{f['why']}]")
print("\nBy rule:")
for r, (n, a) in by_rule.items(): print(f"  {r:<36} {n:>2}  {a:>10.2f}")
print(f"\nRecoverable: {len(rec)} issues, {sum(f['amount'] for f in rec):,.2f}")
print(f"Overdue:     {len(od)} issues, {sum(f['amount'] for f in od):,.2f}")
cr = [f for f in flags if f["bucket"] == "credit_owed"]
print(f"Credits we owe customers: {len(cr)} issues, {sum(f['amount'] for f in cr):,.2f}")
print(f"\nPatterns ({len(patterns)}):")
for p_ in patterns: print("  " + p_)
print(f"\nChecked, not a leak ({len(traps)}):")
for r, t in traps: print(f"  [{r}] {t}")
