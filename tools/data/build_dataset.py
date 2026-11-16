"""Generate the Seams / Northline mock dataset (clean + messy variants + twist file)."""
import csv, os, random
from datetime import date, timedelta

random.seed(7)
OUT = os.path.dirname(os.path.abspath(__file__))
D = lambda s: date.fromisoformat(s)

# ---------------- CRM contracts ----------------
CUSTOMERS = {
    "Lenox Hill Hospital":   dict(rebill="Y", email="ap@lenoxhill.example"),
    "Hudson Yards Cowork":   dict(rebill="Y", email="billing@hycowork.example"),
    "Astoria Medical Group": dict(rebill="Y", email="accounts@astoriamed.example"),
    "Greenpoint Bistro":     dict(rebill="N", email="owner@greenpointbistro.example"),
    "Tribeca Grill":         dict(rebill="N", email="office@tribecagrill.example"),
    "Bed-Stuy Bagel Co":     dict(rebill="N", email="hello@bedstuybagel.example"),
    "Chelsea Dental Offices":dict(rebill="N", email="admin@chelseadental.example"),
    "Flatiron Law Partners": dict(rebill="N", email="ops@flatironlaw.example"),
}
PRICES = {"NAP-2PLY": 34.00, "CUP-12OZ": 31.50, "CTN-TOGO": 42.86, "TOWEL-C": 45.37,
          "FOIL-18": 41.90, "SAN-QUAT": 27.20, "BAG-T": 16.85, "TRAY-9": 24.50, "LID-12": 28.90}
GLOVE_OLD, GLOVE_NEW = 18.50, 21.00   # price increase effective 2026-09-15

contracts = []
cid = 1
for name, c in CUSTOMERS.items():
    for sku, p in PRICES.items():
        contracts.append(dict(contract_id=f"CT-{cid:03d}", customer_name=name, sku=sku, contract_price=f"{p:.2f}",
                              start_date="2026-01-01", end_date="2026-12-31", rebill_freight=c["rebill"],
                              payment_terms_days=30, billing_email=c["email"])); cid += 1
    contracts.append(dict(contract_id=f"CT-{cid:03d}", customer_name=name, sku="GLV-NIT-100", contract_price=f"{GLOVE_OLD:.2f}",
                          start_date="2026-01-01", end_date="2026-09-14", rebill_freight=c["rebill"],
                          payment_terms_days=30, billing_email=c["email"])); cid += 1
    contracts.append(dict(contract_id=f"CT-{cid:03d}", customer_name=name, sku="GLV-NIT-100", contract_price=f"{GLOVE_NEW:.2f}",
                          start_date="2026-09-15", end_date="2026-12-31", rebill_freight=c["rebill"],
                          payment_terms_days=30, billing_email=c["email"])); cid += 1

def cprice(sku, d):
    if sku == "GLV-NIT-100":
        return GLOVE_NEW if d >= D("2026-09-15") else GLOVE_OLD
    return PRICES[sku]

# warehouse name variants (join trap: must resolve to CRM names)
WH_NAME = {"Lenox Hill Hospital": "Lenox Hill Hosp.", "Astoria Medical Group": "Astoria Medical Grp",
           "Tribeca Grill": "TRIBECA GRILL LLC"}

shipments, invoices = [], []
order_seq = [1001]
inv_seq = [5001]
ship_seq = [3001]

def ref_variant(n):
    return random.choice([f"SO-{n}", f"SO{n}", f"{n}", f"SO-{n}"])

def add_order(cust, sku, qty, ship_d, *, freight=0.0, ship_type="standard", invoice=True,
              inv_qty=None, inv_price=None, freight_billed=None, inv_d=None, status="paid",
              order_ref=None, split=None, terms=30, order_no=None):
    n = order_no or order_seq[0]
    if order_no is None:
        order_seq[0] += 1
    ship_d = D(ship_d)
    shipments.append(dict(shipment_id=f"SH-{ship_seq[0]}", order_no=f"SO-{n}",
                          ship_to=WH_NAME.get(cust, cust), sku=sku, qty=qty,
                          ship_date=ship_d.isoformat(), ship_type=ship_type, freight_cost=f"{freight:.2f}"))
    ship_seq[0] += 1
    if not invoice:
        return n
    inv_d = D(inv_d) if inv_d else ship_d + timedelta(days=random.randint(1, 3))
    price = inv_price if inv_price is not None else cprice(sku, inv_d)
    fb = freight_billed if freight_billed is not None else (freight if CUSTOMERS[cust]["rebill"] == "Y" else 0.0)
    parts = split or [inv_qty if inv_qty is not None else qty]
    for i, q in enumerate(parts):
        f_here = fb if i == 0 else 0.0
        amt = round(q * price + f_here, 2)
        due = inv_d + timedelta(days=terms)
        paid = ""
        if status == "paid":
            paid = (inv_d + timedelta(days=random.randint(10, 25))).isoformat()
        invoices.append(dict(invoice_no=f"INV-{inv_seq[0]}", order_ref=(order_ref if order_ref is not None else ref_variant(n)),
                             customer=cust, sku=sku, qty=q, unit_price=f"{price:.2f}", freight_billed=f"{f_here:.2f}",
                             amount=f"{amt:.2f}", invoice_date=inv_d.isoformat(), due_date=due.isoformat(),
                             status=status, paid_date=paid))
        inv_seq[0] += 1
    return n

# ---------- background clean orders (no issues) ----------
clean_skus = list(PRICES)
for cust in CUSTOMERS:
    for _ in range(6):
        sku = random.choice(clean_skus)
        qty = random.choice([10, 12, 15, 20, 24, 30, 40])
        d = D("2026-08-03") + timedelta(days=random.randint(0, 80))
        reb = CUSTOMERS[cust]["rebill"] == "Y"
        fr = round(random.uniform(25, 90), 2) if reb else 0.0
        st = "paid" if d < D("2026-10-15") else "open"
        add_order(cust, sku, qty, d.isoformat(), freight=fr, status=st)
    # one clean post-increase glove order at the new price
    d = D("2026-09-25") + timedelta(days=random.randint(0, 25))
    reb = CUSTOMERS[cust]["rebill"] == "Y"
    add_order(cust, "GLV-NIT-100", 20, d.isoformat(), freight=(40.00 if reb else 0.0),
              status="paid" if d < D("2026-10-15") else "open")

# ---------- PLANTED ISSUES ----------
# Shipped, not invoiced (3) = 3,970.22
add_order("Greenpoint Bistro", "NAP-2PLY", 40, "2026-10-21", invoice=False)                    # 1,360.00
add_order("Lenox Hill Hospital", "GLV-NIT-100", 80, "2026-10-24", freight=85.40, invoice=False)  # 1,680 + 85.40
add_order("Hudson Yards Cowork", "CUP-12OZ", 25, "2026-10-28", freight=57.32, invoice=False)     # 787.50 + 57.32

# Short-billed (2) = 513.21
SB1 = add_order("Chelsea Dental Offices", "TOWEL-C", 20, "2026-10-06", inv_qty=17)   # 3 x 45.37 = 136.11  (twist return clears)
add_order("Bed-Stuy Bagel Co", "FOIL-18", 24, "2026-10-09", inv_qty=15)        # 9 x 41.90 = 377.10

# Below contract (5) = 2,033.00
add_order("Lenox Hill Hospital", "GLV-NIT-100", 200, "2026-09-22", freight=60.00, inv_price=GLOVE_OLD)   # 500
add_order("Astoria Medical Group", "GLV-NIT-100", 160, "2026-09-25", freight=55.00, inv_price=GLOVE_OLD) # 400
add_order("Chelsea Dental Offices", "GLV-NIT-100", 120, "2026-10-01", inv_price=GLOVE_OLD)              # 300
add_order("Flatiron Law Partners", "GLV-NIT-100", 96, "2026-10-07", inv_price=GLOVE_OLD)               # 240
add_order("Bed-Stuy Bagel Co", "CTN-TOGO", 50, "2026-10-13", inv_price=31.00)                          # 593

# Freight not rebilled (3) = 404.11
add_order("Lenox Hill Hospital", "SAN-QUAT", 30, "2026-09-29", freight=142.50, freight_billed=0.0)
add_order("Astoria Medical Group", "BAG-T", 40, "2026-10-02", freight=168.40, freight_billed=40.00)
add_order("Hudson Yards Cowork", "LID-12", 30, "2026-10-15", freight=133.21, freight_billed=0.0)

# Overdue receivables (5) = 13,977.99   (as-of 2026-11-13, due on/before 2026-10-14)
add_order("Lenox Hill Hospital", "FOIL-18", 100, "2026-09-03", freight=20.00, inv_d="2026-09-05", status="open")    # 4,210.00
add_order("Hudson Yards Cowork", "CUP-12OZ", 98, "2026-08-26", freight=18.50, inv_d="2026-08-28", status="open")    # 3,105.50
add_order("Astoria Medical Group", "SAN-QUAT", 105, "2026-08-31", freight=24.25, inv_d="2026-09-02", status="open") # 2,880.25
add_order("Hudson Yards Cowork", "FOIL-18", 55, "2026-09-08", freight=7.74, inv_d="2026-09-10", status="open")      # 2,312.24
add_order("Greenpoint Bistro", "TRAY-9", 60, "2026-08-18", inv_d="2026-08-20", status="open")                       # 1,470.00

# Hudson Yards LID-12 order that the twist's doubled credit memo refers to (clean, paid)
LID_ORDER = add_order("Hudson Yards Cowork", "LID-12", 40, "2026-09-14", freight=30.00)
# Greenpoint napkins order (clean, paid); twist return of 5 cases with NO credit memo = credit never issued
NAP_ORDER = add_order("Greenpoint Bistro", "NAP-2PLY", 30, "2026-09-22")

# Billed ABOVE contract = credits Northline owes customers (2) = 180.00
add_order("Tribeca Grill", "TOWEL-C", 40, "2026-09-16", inv_price=48.37)       # (48.37-45.37) x 40 = 120.00, credit-only letter
add_order("Chelsea Dental Offices", "BAG-T", 30, "2026-10-14", inv_price=18.85) # (18.85-16.85) x 30 = 60.00, mixed letter

# ---------- TRAPS (must NOT flag) ----------
add_order("Astoria Medical Group", "GLV-NIT-100", 30, "2026-09-14", freight=35.00, inv_d="2026-09-15")  # T13 new price on day one: looks overbilled vs ship-date price
add_order("Tribeca Grill", "NAP-2PLY", 2, "2026-10-14", ship_type="sample", invoice=False)               # T1 sample
add_order("Astoria Medical Group", "GLV-NIT-100", 10, "2026-10-16", ship_type="replacement", invoice=False)  # T2 replacement
add_order("Tribeca Grill", "BAG-T", 40, "2026-10-02", inv_d="2026-10-05", order_ref="")                  # T3 blank order ref
add_order("Lenox Hill Hospital", "GLV-NIT-100", 100, "2026-09-08", freight=48.00, inv_d="2026-09-10")    # T4 old glove price, pre-increase
add_order("Tribeca Grill", "CTN-TOGO", 60, "2026-10-08", split=[35, 25])                                 # T5 split invoice
add_order("Greenpoint Bistro", "CUP-12OZ", 30, "2026-10-12", freight=64.00)                              # T6 non-rebill freight
add_order("Flatiron Law Partners", "NAP-2PLY", 20, "2026-10-06", inv_d="2026-10-08", status="open")      # T7 only 6 days late
n = add_order("Bed-Stuy Bagel Co", "SAN-QUAT", 25, "2026-10-19", order_no=1990)                          # T8 order ref "so 1990"
invoices[-1]["order_ref"] = "so 1990"
# T9 name variants are in WH_NAME (Lenox Hill Hosp., Astoria Medical Grp, TRIBECA GRILL LLC)

# ---------------- AP bills ----------------
ap = []
b = [9001]
def bill(vendor, inv, d, amt, po=None, po_amt=None, pay_d=None):
    ap.append(dict(bill_id=f"B-{b[0]}", vendor=vendor, vendor_invoice_no=inv, bill_date=d, amount=f"{amt:.2f}",
                   po_no=po or "", po_amount=f"{po_amt:.2f}" if po_amt is not None else "",
                   payment_id=f"PAY-{b[0]+400}", paid_date=pay_d or (D(d) + timedelta(days=14)).isoformat()))
    b[0] += 1

# clean vendor bills
for i, (v, a) in enumerate([("Hudson Paper Co", 5120.00), ("Atlas Packaging", 2875.00), ("CleanCo Chemical", 1980.00),
                            ("Empire Glove Supply", 7400.00), ("Atlas Packaging", 3310.00), ("Hudson Paper Co", 4480.00)]):
    bill(v, f"{v.split()[0][:2].upper()}-{7700+i*13}", f"2026-0{8 + i % 2}-{10 + i:02d}", a, f"PO-{6100+i}", a)
# T10 rent: same vendor + amount monthly, different invoice numbers
for m in ("08", "09", "10"):
    bill("Bronx Realty LLC", f"RENT-2026-{m}", f"2026-{m}-01", 8500.00)
# T11 weekly freight: same vendor + amount, different invoice numbers
for wk in ("0911", "0918", "0925", "1002"):
    bill("Metro Freight Lines", f"MF-{wk}", f"2026-{wk[:2]}-{wk[2:]}", 1150.00)
# Duplicate vendor payments (2) = 9,608.40
bill("Hudson Paper Co", "HP-7781", "2026-09-08", 6240.00, "PO-6201", 6240.00, "2026-09-12")
bill("Hudson Paper Co", "hp7781", "2026-09-08", 6240.00, "PO-6201", 6240.00, "2026-09-26")
bill("Atlas Packaging", "AP/2210", "2026-09-30", 3368.40, "PO-6202", 3368.40, "2026-10-09")
bill("Atlas Packaging", "AP-2210", "2026-09-30", 3368.40, "PO-6202", 3368.40, "2026-10-21")
# Vendor over PO (2) = 1,752.00
bill("Empire Glove Supply", "EG-4410", "2026-09-18", 12450.00, "PO-6203", 11500.00)   # 950.00
bill("CleanCo Chemical", "CC-0982", "2026-10-03", 5802.00, "PO-6204", 5000.00)        # 802.00
# T12 bill only $2.40 over PO
bill("Atlas Packaging", "AP-2290", "2026-10-11", 4802.40, "PO-6205", 4800.00)

# ---------------- Twist: returns log ----------------
sb1_order = f"SO-{SB1}"
returns = [
    dict(return_id="RET-0401", order_ref=sb1_order.replace("SO-", "SO"), customer="Chelsea Dental Offices", sku="TOWEL-C",
         qty_returned=3, return_date="2026-10-11", credit_memo_no="", credit_amount="0.00", note="damaged on delivery, never billed"),
    dict(return_id="RET-0405", order_ref="SO-1003", customer="Lenox Hill Hospital", sku=shipments[2]["sku"],
         qty_returned=2, return_date="2026-10-15", credit_memo_no="CM-301",
         credit_amount=f"{2*float(invoices[2]['unit_price']):.2f}", note="wrong size"),
    dict(return_id="RET-0412", order_ref=f"SO-{LID_ORDER}", customer="Hudson Yards Cowork", sku="LID-12",
         qty_returned=8, return_date="2026-10-20", credit_memo_no="CM-305", credit_amount="231.20", note="lids cracked"),
    dict(return_id="RET-0412", order_ref=f"SO-{LID_ORDER}", customer="Hudson Yards Cowork", sku="LID-12",
         qty_returned=8, return_date="2026-10-20", credit_memo_no="cm305", credit_amount="231.20", note="lids cracked"),
    dict(return_id="RET-0418", order_ref=f"SO{NAP_ORDER}", customer="Greenpoint Bistro", sku="NAP-2PLY",
         qty_returned=5, return_date="2026-10-27", credit_memo_no="", credit_amount="0.00", note="wrong ply, credit pending"),
]
assert returns[1]["sku"] == shipments[2]["sku"]

def write(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

random.shuffle(shipments); random.shuffle(invoices)
shipments.sort(key=lambda r: r["ship_date"]); invoices.sort(key=lambda r: r["invoice_date"])
write(f"{OUT}/clean/crm_contracts.csv", contracts)
write(f"{OUT}/clean/warehouse_shipments.csv", shipments)
write(f"{OUT}/clean/billing_invoices.csv", invoices)
write(f"{OUT}/clean/ap_bills.csv", ap)
write(f"{OUT}/clean/twist_returns_log.csv", returns)

# ---------------- messy variant: renamed headers, US dates, reordered columns ----------------
def us(d): return "" if not d else f"{d[5:7]}/{d[8:10]}/{d[:4]}"
RENAME = {
    "crm_contracts": {"contract_id": "Contract #", "customer_name": "Account Name", "sku": "Item Code",
                      "contract_price": "Agreed Price ($)", "start_date": "Effective From", "end_date": "Effective To",
                      "rebill_freight": "Pass-through Freight?", "payment_terms_days": "Net Terms", "billing_email": "AP Contact Email"},
    "warehouse_shipments": {"shipment_id": "Ship ID", "order_no": "Sales Order", "ship_to": "Ship To", "sku": "Item",
                            "qty": "Qty Shipped", "ship_date": "Ship Dt", "ship_type": "Shipment Type", "freight_cost": "Carrier Cost"},
    "billing_invoices": {"invoice_no": "Inv #", "order_ref": "Customer PO / SO Ref", "customer": "Bill To", "sku": "Product",
                         "qty": "Qty Billed", "unit_price": "Rate", "freight_billed": "Shipping Charged", "amount": "Invoice Total",
                         "invoice_date": "Inv Date", "due_date": "Due", "status": "Payment Status", "paid_date": "Date Paid"},
    "ap_bills": {"bill_id": "Bill ID", "vendor": "Supplier", "vendor_invoice_no": "Supplier Inv No", "bill_date": "Bill Dt",
                 "amount": "Amount Paid", "po_no": "PO Number", "po_amount": "PO Value", "payment_id": "Payment Ref", "paid_date": "Payment Dt"},
    "twist_returns_log": {"return_id": "RMA #", "order_ref": "Orig Order", "customer": "Customer Name", "sku": "SKU",
                          "qty_returned": "Units Back", "return_date": "RMA Date", "credit_memo_no": "Credit Memo",
                          "credit_amount": "Credit $", "note": "Reason"},
}
DATE_COLS = {"start_date", "end_date", "ship_date", "invoice_date", "due_date", "paid_date", "bill_date", "return_date"}
for name, rows in [("crm_contracts", contracts), ("warehouse_shipments", shipments), ("billing_invoices", invoices),
                   ("ap_bills", ap), ("twist_returns_log", returns)]:
    cols = list(rows[0].keys()); random.shuffle(cols)
    out = [{RENAME[name][c]: (us(r[c]) if c in DATE_COLS else r[c]) for c in cols} for r in rows]
    write(f"{OUT}/messy_headers/{name}.csv", out)
print("rows:", len(contracts), len(shipments), len(invoices), len(ap), len(returns))
