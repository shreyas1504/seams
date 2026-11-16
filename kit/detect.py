"""Seams detector for the Northline kit.
Reads the raw CSVs (one or more month folders; transactions appended, master files from the LAST folder),
applies billing_rules.md, writes findings.csv (scored) and evidence.csv (proof) for the Base44 app.
  python3 kit/detect.py OUT_DIR DATA_DIR [DATA_DIR ...]
"""
import sys, re, csv, os
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
import pandas as pd

OUT = sys.argv[1]
DIRS = sys.argv[2:]
MASTER = ["customers", "contract_prices", "products", "suppliers"]
TRANS = ["delivery_log", "invoices", "purchase_orders", "supplier_bills", "inbox"]

def load(name):
    if name in MASTER:
        return pd.read_csv(os.path.join(DIRS[-1], f"{name}.csv"), dtype=str).fillna("")
    frames = []
    for d in DIRS:
        p = os.path.join(d, f"{name}.csv")
        if os.path.exists(p):
            f = pd.read_csv(p, dtype=str).fillna("")
            f["_month"] = os.path.basename(os.path.normpath(d))
            frames.append(f)
    return pd.concat(frames, ignore_index=True).drop_duplicates(subset=[c for c in frames[0].columns if c != "_month"], keep="first")

cust, contracts, prods, sups = (load(n) for n in MASTER)
dl, inv, po, bills, inbox = (load(n) for n in TRANS)

D = lambda s: Decimal(str(s or "0").replace(",", "") or "0")
C = lambda x: x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
def dt(s):
    s = str(s or "")[:10]
    try: return date.fromisoformat(s)
    except Exception: return None
HOLIDAYS = {date(2026, 9, 7), date(2026, 11, 26)}
def add_bd(d, n):
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5 and d not in HOLIDAYS: n -= 1
    return d
def month_of(d):
    return {9: "september", 10: "october", 11: "november", 8: "august"}.get(d.month, d.strftime("%B").lower()) if d else ""

# data cutoff = last date seen in transactions
CUTOFF = max(filter(None, [dt(x) for x in list(dl.delivery_date) + list(inv.date) + list(bills.bill_date)]))
TAX = Decimal("0.08875")

custs = {r.customer_id: r for r in cust.itertuples()}
cust_by_qb = {r.quickbooks_name: r for r in cust.itertuples()}
prod = {r.sku: r for r in prods.itertuples()}
sup_by_vendor = {r.quickbooks_vendor_name: r for r in sups.itertuples()}
sup_by_id = {r.supplier_id: r for r in sups.itertuples()}
contract_rows = {}
for r in contracts.itertuples():
    contract_rows.setdefault((r.customer_id, r.sku), []).append(r)

# ---- email exceptions approved by Dana (billing_rules section 8) ----
def kc_group(cid):
    c = custs.get(cid)
    return c is not None and "kettle & crumb" in (c.group_name + c.customer_name).lower()
def fee_waived(cid, d):
    c = custs.get(cid)
    return c is not None and "copper biryani roasters" in c.customer_name.lower() and date(2026, 9, 21) <= d <= date(2026, 10, 16)
BAGEL = {"NL-10154": Decimal("40.85"), "NL-10994": Decimal("16.10")}

def tier_disc(c, d):
    tier = c.price_tier
    if c.previous_tier and dt(c.tier_effective_from) and d < dt(c.tier_effective_from):
        tier = c.previous_tier
    return {"A": Decimal("0.10"), "B": Decimal("0.06"), "C": Decimal("0.03"), "D": Decimal("0")}.get(tier, Decimal("0")), tier

def list_price(p, d, freeze_sep13=False):
    lp, frm, prev = D(p.list_price), dt(p.list_price_from), p.previous_list_price
    ref = date(2026, 9, 13) if freeze_sep13 else d
    if frm and ref < frm and prev:
        return D(prev), "previous"
    return lp, "current"

def expected_price(cid, sku, d):
    """(unit price, basis text, kind) per billing_rules 1 and the approved exceptions."""
    c = custs.get(cid); p = prod.get(sku)
    if c is None or p is None: return None, "", ""
    if "bagel kitchen" in c.customer_name.lower() and sku in BAGEL and d >= date(2026, 10, 1):
        return BAGEL[sku], f"Dana approved {BAGEL[sku]} from Oct 1 (email M-001846)", "exception"
    for k in contract_rows.get((cid, sku), []):
        s, e = dt(k.start_date), dt(k.end_date)
        if s and s <= d and (not e or d <= e):
            return D(k.contract_price), f"contract {k.contract_id} {k.contract_price}", "contract"
    disc, tier = tier_disc(c, d)
    freeze = kc_group(cid) and date(2026, 9, 14) <= d <= date(2026, 10, 31)
    lp, which = list_price(p, d, freeze)
    price = C(lp * (1 - disc))
    basis = f"list {lp} ({which}{', Sep 13 price kept per email M-001839' if freeze else ''}) less tier {tier} {int(disc*100)}%"
    return price, basis, "tier"

findings, evidence = [], []
seen = set()
def add(fid, problem, amount, month, cause, ev, party="", category="", explanation="", action="", **ids):
    if fid in seen: return
    seen.add(fid)
    row = {"problem": problem, "delivery_id": "", "invoice_no": "", "sku": "", "po_no": "", "bill_id": "", "supplier": "", "message_id": "",
           "amount": f"{C(Decimal(amount)):.2f}", "month": month, "cause": cause, "finding_id": fid,
           "party": party, "category": category, "explanation": explanation, "action_type": action}
    row.update({k: v for k, v in ids.items() if v})
    findings.append(row)
    for e in ev:
        evidence.append({"finding_id": fid, "file": e[0], "record": e[1], "shows": e[2], "expected": e[3] if len(e) > 3 else ""})

# ---------------- customer side ----------------
inv["did"] = inv.memo.str.extract(r"(D-\d{6}-\d{4})", expand=False).fillna("")
# Invoices with no delivery ID in the memo: match on customer + delivery date (ship_date, else invoice date).
_dl_key = {}
for r in dl.drop_duplicates("delivery_id").itertuples():
    c = custs.get(r.customer_id)
    if c is not None:
        _dl_key.setdefault((c.quickbooks_name, r.delivery_date), []).append(r.delivery_id)
for no, g in inv[(inv.transaction_type == "Invoice")].groupby("invoice_no"):
    if (g.did != "").any(): continue
    g0 = g.iloc[0]
    cands = _dl_key.get((g0.customer, g0.ship_date)) or _dl_key.get((g0.customer, g0.date)) or []
    if not cands:
        # same customer, delivery within 3 days before the invoice, matching SKUs
        skus = set(g.item) - {"DEL-FEE"}
        best = None
        for (qb, dd), ids in _dl_key.items():
            if qb != g0.customer or not dt(dd) or not dt(g0.date): continue
            if 0 <= (dt(g0.date) - dt(dd)).days <= 7:
                for did in ids:
                    ds = set(dl[dl.delivery_id == did].sku)
                    ov = len(ds & skus)
                    if ov and (best is None or ov > best[0]): best = (ov, did)
        cands = [best[1]] if best else []
    if len(cands) == 1:
        inv.loc[inv.invoice_no == no, "did"] = cands[0]
invl = inv[inv.transaction_type == "Invoice"].copy()
cms = inv[inv.transaction_type == "Credit Memo"].copy()
dl["qd"] = dl.qty_delivered.apply(lambda x: int(float(x or 0)))
deliveries = {k: g for k, g in dl.groupby("delivery_id")}
inv_by_delivery = {}
for no, g in invl.groupby("invoice_no"):
    for did in set(g.did) - {""}:
        inv_by_delivery.setdefault(did, []).append(no)

# billing corrections per invoice+sku (fix the invoice; damaged goods credits do not)
corr = {}
for r in cms[cms.reason_code == "BILLING_CORRECTION"].itertuples():
    corr.setdefault((r.invoice_no, r.item), []).append(r)

def delivery_value(g, cid, d):
    tot = Decimal(0)
    for r in g.itertuples():
        if r.qd <= 0: continue
        pr, _, _ = expected_price(cid, r.sku, d)
        if pr is not None: tot += C(pr * r.qd)
    return tot

# 1) delivery never invoiced (after 3 business days), not SAMPLE / REFUSED
for did, g in deliveries.items():
    g0 = g.iloc[0]
    if g0.order_type == "SAMPLE" or (g.delivery_status == "REFUSED").all() or g.qd.sum() <= 0: continue
    d = dt(g0.delivery_date)
    if did in inv_by_delivery: continue
    if add_bd(d, 3) >= CUTOFF: continue
    cid = g0.customer_id; c = custs.get(cid)
    sub = delivery_value(g, cid, d)
    fee = Decimal(35) if sub < 300 and not (c is not None and dt(c.free_delivery_from) and dt(c.free_delivery_from) <= d and (not dt(c.free_delivery_to) or d <= dt(c.free_delivery_to))) and not fee_waived(cid, d) else Decimal(0)
    name = c.customer_name if c is not None else cid
    add(f"NOTINV-{did}", "Delivery never invoiced", sub + fee, month_of(d), "Deliveries never invoiced after 3 business days", [
        ("delivery_log.csv", f"delivery {did} ({len(g)} lines)", f"Delivered {d:%b %d}: {int(g.qd.sum())} cases, ${sub:.2f} at correct prices" + (f" + $35.00 fee" if fee else ""), f"An invoice by {add_bd(d,3):%b %d}"),
        ("invoices.csv", "all invoices", f"No invoice memo mentions {did}", "One invoice for this delivery")],
        party=name, category="Warehouse→Billing", explanation=f"{name} received {int(g.qd.sum())} cases on {d:%b %d} and was never billed.", action="catch_up_invoice", delivery_id=did)

# 2) duplicate invoices for one delivery
for did, nos in inv_by_delivery.items():
    if len(nos) < 2: continue
    nos = sorted(nos)
    for extra in nos[1:]:
        g = invl[invl.invoice_no == extra]
        sub = sum(D(x) for x in g.amount)
        cname = g.iloc[0].customer
        add(f"DUPINV-{extra}", "Delivery invoiced twice", -sub, month_of(dt(g.iloc[0].date)), "Deliveries invoiced twice", [
            ("invoices.csv", f"invoice {nos[0]}", f"First invoice for {did}", ""),
            ("invoices.csv", f"invoice {extra}", f"Second invoice for {did}: ${sub:.2f}", "Only one invoice per delivery")],
            party=cname, category="Warehouse→Billing", explanation=f"{cname} was billed twice for delivery {did}.", action="credit_memo", invoice_no=extra)

# per invoice line checks
for no, g in invl.groupby("invoice_no"):
    g0 = g.iloc[0]
    dids = sorted(set(g.did) - {""})
    did = dids[0] if dids else ""
    dg = deliveries.get(did)
    qbname = g0.customer
    c_inv = cust_by_qb.get(qbname)
    if dg is None:
        continue
    dcid = dg.iloc[0].customer_id
    d = dt(dg.iloc[0].delivery_date)
    c = custs.get(dcid)
    mon = month_of(dt(g0.date))
    cname = c.customer_name if c is not None else qbname
    # 3) wrong customer on invoice
    if c is not None and qbname != c.quickbooks_name:
        sub = sum(D(x) for x in g.amount)
        add(f"WRONGCUST-{no}", "Invoice billed to wrong customer", sub, mon, "Invoices addressed to the wrong customer", [
            ("invoices.csv", f"invoice {no}", f"Customer {qbname}", c.quickbooks_name),
            ("delivery_log.csv", f"delivery {did}", f"Delivered to {c.customer_name} ({dcid})", "")],
            party=c.customer_name, category="Warehouse→Billing", explanation=f"Invoice {no} went to {qbname} but {c.customer_name} received the goods.", action="catch_up_invoice", invoice_no=no)
    # 4) sample / refused billed
    if dg.iloc[0].order_type == "SAMPLE" or (dg.delivery_status == "REFUSED").all():
        sub = sum(D(x) for x in g.amount)
        kind = "sample order" if dg.iloc[0].order_type == "SAMPLE" else "refused delivery"
        add(f"NOBILL-{no}", f"Invoiced a {kind}", -sub, mon, f"Invoiced a {kind}", [
            ("invoices.csv", f"invoice {no}", f"Billed ${sub:.2f}", "$0.00"),
            ("delivery_log.csv", f"delivery {did}", f"{kind.capitalize()}", "Not invoiced")],
            party=cname, category="Warehouse→Billing", explanation=f"{kind.capitalize()} {did} should not be billed.", action="credit_memo", invoice_no=no)
        continue
    dlines = {r.sku: r for r in dg.itertuples()}
    merch_expected = Decimal(0)
    fee_lines = g[g.item == "DEL-FEE"]
    for r in g.itertuples():
        if r.item == "DEL-FEE": continue
        dlr = dlines.get(r.item)
        qty, rate = int(float(r.qty or 0)), D(r.rate)
        cq = sum(int(float(x.qty or 0)) for x in corr.get((no, r.item), []))
        camt = sum(D(x.amount) for x in corr.get((no, r.item), []))
        exp, basis, kind = expected_price(dcid, r.item, d)
        delivered = dlr.qd if dlr is not None else 0
        if exp is not None and delivered > 0: merch_expected += C(exp * delivered)
        # quantity: billed vs delivered (after billing corrections)
        net_qty = qty + cq
        if dlr is not None and net_qty != delivered:
            diff = delivered - net_qty
            amt = C(rate * diff)
            prob = "Billed more cases than delivered" if diff < 0 else "Billed fewer cases than delivered"
            add(f"QTY-{no}-{r.item}", prob, amt, mon, ("Billed for cases that never arrived" if diff < 0 else "Delivered cases left off the invoice"), [
                ("invoices.csv", f"invoice {no}, line {r.line_no}", f"{qty} cases at ${rate}" + (f" (corrected {cq})" if cq else ""), f"{delivered} cases"),
                ("delivery_log.csv", f"delivery {did}, {r.item}", f"ordered {dlr.qty_ordered}, shipped {dlr.qty_shipped}, delivered {delivered}" + (f" ({dlr.short_reason})" if dlr.short_reason else ""), "")],
                party=cname, category="Warehouse→Billing", explanation=f"{cname} was billed {net_qty} cases of {r.item} but {delivered} arrived.", action="credit_memo" if diff < 0 else "catch_up_invoice", invoice_no=no, sku=r.item)
        elif dlr is None and qty > 0:
            add(f"QTY-{no}-{r.item}", "Billed an item not delivered", -C(rate * net_qty), mon, "Billed items that were not on the delivery", [
                ("invoices.csv", f"invoice {no}, line {r.line_no}", f"{qty} cases of {r.item}", "0 cases"),
                ("delivery_log.csv", f"delivery {did}", f"No {r.item} line", "")],
                party=cname, category="Warehouse→Billing", explanation=f"{r.item} is billed but was not on the delivery.", action="credit_memo", invoice_no=no, sku=r.item)
        # price
        if exp is not None and delivered > 0:
            eff_rate = rate
            if camt and cq == 0 and net_qty:  # price correction credit
                eff_rate = C((rate * qty + camt) / qty)
            if abs(eff_rate - exp) >= Decimal("0.01"):
                bill_q = net_qty if net_qty > 0 else delivered
                amt = C((exp - eff_rate) * min(bill_q, delivered))
                p = prod.get(r.item)
                prev_price = None
                if p is not None and p.previous_list_price:
                    disc, _ = tier_disc(c, d)
                    prev_price = C(D(p.previous_list_price) * (1 - disc))
                if kind == "tier" and prev_price is not None and eff_rate == prev_price and dt(p.list_price_from) and d >= dt(p.list_price_from):
                    prob, cause = "Old price after increase", f"{r.item} still at its pre-{dt(p.list_price_from):%b %d} price"
                elif kind == "tier" and c.previous_tier and eff_rate == C(list_price(p, d)[0] * (1 - {"A": Decimal("0.10"), "B": Decimal("0.06"), "C": Decimal("0.03"), "D": Decimal("0")}.get(c.previous_tier, 0))):
                    prob, cause = "Billed at old tier", f"{cname} still billed at tier {c.previous_tier}"
                elif kind == "contract":
                    prob, cause = "Contract price not applied", f"{cname} contract price not applied"
                else:
                    prob, cause = ("Underbilled price" if amt > 0 else "Overbilled price"), f"{cname} billed off the price list"
                if kind == "tier" and any(k for k in contract_rows.get((dcid, r.item), []) if dt(k.end_date) and dt(k.end_date) < d and D(k.contract_price) == eff_rate):
                    prob, cause = "Expired contract price used", f"{cname} contract ended but price kept"
                add(f"PRICE-{no}-{r.item}", prob, amt, mon, cause, [
                    ("invoices.csv", f"invoice {no}, line {r.line_no}", f"rate ${eff_rate} x {bill_q} cases", f"${exp} a case"),
                    ("products.csv" if kind == "tier" else "contract_prices.csv", r.item, basis, ""),
                    ("customers.csv", cname, f"tier {c.price_tier}" + (f" (was {c.previous_tier} before {c.tier_effective_from})" if c.previous_tier else ""), ""),
                    ("delivery_log.csv", f"delivery {did}, {r.item}", f"{delivered} cases delivered {d:%b %d}", "")],
                    party=cname, category="CRM→Billing", explanation=f"{r.item} billed at ${eff_rate}; the rules give ${exp}.", action="catch_up_invoice" if amt > 0 else "credit_memo", invoice_no=no, sku=r.item)
        # tax
        p = prod.get(r.item)
        if p is not None:
            exempt = c is not None and c.tax_exempt == "Y" and (not dt(c.exempt_cert_expires) or d <= dt(c.exempt_cert_expires))
            should = p.taxable == "Y" and not exempt
            charged = D(r.line_tax)
            exp_tax = C(D(r.amount) * TAX) if should else Decimal(0)
            if abs(exp_tax - charged) >= Decimal("0.02") and not (charged == 0 and not should):
                why = "taxable item not taxed" if should and charged == 0 else ("tax-exempt customer charged tax" if not should and exempt else ("non-taxable item taxed" if not should else "tax miscalculated"))
                if c is not None and c.tax_exempt == "Y" and not exempt and should: why = "exemption certificate expired, tax not charged"
                add(f"TAX-{no}-{r.item}", "Sales tax wrong", exp_tax - charged, mon, f"Sales tax: {why}" + (f" ({r.item})" if "item" in why else f" ({cname})"), [
                    ("invoices.csv", f"invoice {no}, line {r.line_no}", f"line tax ${charged} on ${r.amount}", f"${exp_tax}"),
                    ("products.csv", r.item, f"taxable {p.taxable}", ""),
                    ("customers.csv", cname, f"tax exempt {c.tax_exempt if c is not None else ''} until {c.exempt_cert_expires if c is not None else ''}", "")],
                    party=cname, category="CRM→Billing", explanation=why.capitalize() + ".", action="catch_up_invoice" if exp_tax > charged else "credit_memo", invoice_no=no, sku=r.item)
    # 5) delivery fee
    in_free = c is not None and dt(c.free_delivery_from) and dt(c.free_delivery_from) <= d and (not dt(c.free_delivery_to) or d <= dt(c.free_delivery_to))
    due = merch_expected < 300 and not in_free and not fee_waived(dcid, d)
    nfee = len(fee_lines); fee_amt = sum(D(x) for x in fee_lines.amount)
    if due and nfee == 0:
        add(f"FEE-MISSING-{no}", "Delivery fee not charged", 35, mon, "Delivery fee missing on small orders", [
            ("invoices.csv", f"invoice {no}", "No DEL-FEE line", "$35.00 fee"),
            ("delivery_log.csv", f"delivery {did}", f"merchandise ${merch_expected:.2f} at correct prices", "under $300.00")],
            party=cname, category="Warehouse→Billing", explanation=f"Order under $300 and no free-delivery period: $35 fee due.", action="catch_up_invoice", invoice_no=no, sku="DEL-FEE")
    elif nfee >= 2:
        add(f"FEE-DUP-{no}", "Delivery fee billed twice", -(fee_amt - (35 if due else 0)), mon, "Delivery fee billed twice", [
            ("invoices.csv", f"invoice {no}", f"{nfee} DEL-FEE lines, ${fee_amt:.2f}", "At most one $35.00 fee")],
            party=cname, category="Warehouse→Billing", explanation="The same delivery was charged the fee more than once.", action="credit_memo", invoice_no=no, sku="DEL-FEE")
    elif nfee == 1 and not due:
        reason = "free-delivery period" if in_free else ("fee waived by Dana (M-001843)" if fee_waived(dcid, d) else f"order ${merch_expected:.2f} is $300 or more")
        add(f"FEE-EXTRA-{no}", "Delivery fee charged when not due", -fee_amt, mon, f"Delivery fee charged: {reason.split(' (')[0] if 'waived' in reason else ('free-delivery period' if in_free else 'order over $300')}", [
            ("invoices.csv", f"invoice {no}", f"DEL-FEE ${fee_amt:.2f}", "$0.00"),
            ("customers.csv" if in_free else "delivery_log.csv", cname if in_free else f"delivery {did}", reason, "No fee")],
            party=cname, category="Warehouse→Billing", explanation=f"No fee was due: {reason}.", action="credit_memo", invoice_no=no, sku="DEL-FEE")

# ---------------- supplier side ----------------
po["qa"] = po.qty_accepted.apply(lambda x: int(float(x or 0)))
def clean_po(x):
    t = re.sub(r"^\s*P\s*[O0]\s*[-#:]?\s*", "", str(x or "").upper())  # "PO-", "PO ", "P0-" typed by hand
    d = re.sub(r"\D", "", t)
    return f"PO-{d}" if d else ""
def pack_count(code):
    sku = {r.supplier_item_code: r for r in prods.itertuples()}.get(code)
    m = re.match(r"\s*(\d+)", sku.pack) if sku is not None else None
    return int(m.group(1)) if m else 1
_pack = {}
def pk(code):
    if code not in _pack: _pack[code] = pack_count(code)
    return _pack[code]
bills["po_ref_raw"] = bills.po_ref
bills["po_ref"] = bills.po_ref.apply(clean_po)
# Bills in EA: convert to cases and cost per case so they compare with the PO.
def _cases(r):
    q, c = Decimal(str(r.qty or 0)), Decimal(str(r.unit_cost or 0))
    if r.uom == "EA" and r.line_type == "ITEM":
        n = pk(r.supplier_item_code)
        return q / n, c * n
    return q, c
bills[["cq", "cc"]] = bills.apply(lambda r: pd.Series(_cases(r)), axis=1)
# Blank PO ref: the PO from this supplier that has this item, closest before the bill date.
_po_sup = {}
for r in po.itertuples():
    _po_sup.setdefault((r.supplier_id, r.supplier_item_code), []).append(r)
_po_keys = set(zip(po.po_no, po.supplier_item_code))
# Blank or mistyped PO ref: find the PO from this supplier that has these items. Decide per bill, using all its lines.
for bid, g in bills[bills.line_type == "ITEM"].groupby("bill_id"):
    if all((r.po_ref, r.supplier_item_code) in _po_keys for r in g.itertuples()):
        continue
    s = sup_by_vendor.get(g.iloc[0].vendor)
    if s is None: continue
    score = {}
    for r in g.itertuples():
        for x in _po_sup.get((s.supplier_id, r.supplier_item_code), []):
            if dt(x.po_date) and dt(r.bill_date) and dt(x.po_date) <= dt(r.bill_date):
                score[x.po_no] = score.get(x.po_no, 0) + (2 if int(float(x.qty_accepted or 0)) == int(float(r.cq)) else 1)
    if score:
        best = max(score.items(), key=lambda kv: (kv[1], kv[0]))[0]
        bills.loc[bills.bill_id == bid, "po_ref"] = best
po_lines = {}
for r in po.itertuples():
    po_lines.setdefault((r.po_no, r.supplier_item_code), []).append(r)
po_by_code = {}
for r in po.itertuples():
    po_by_code.setdefault(r.supplier_item_code, []).append(r)
code_to_sku = {r.supplier_item_code: r.sku for r in prods.itertuples()}
billed_qty = {}
for r in bills[bills.line_type == "ITEM"].itertuples():
    billed_qty.setdefault((r.po_ref, r.supplier_item_code), 0)
for bid, g in bills.groupby("bill_id"):
    g0 = g.iloc[0]
    s = sup_by_vendor.get(g0.vendor)
    mon = month_of(dt(g0.bill_date))
    vname = s.supplier_name if s is not None else g0.vendor
    sid = s.supplier_id if s is not None else ""
    # bank account
    if s is not None and g0.remit_to_account_last4 and g0.remit_to_account_last4 != s.bank_account_last4:
        tot = D(g0.bill_total)
        add(f"BANK-{bid}", "Payment to unverified bank account", tot, mon, f"{vname} bills paid to account ...{g0.remit_to_account_last4}, not the account on file", [
            ("supplier_bills.csv", f"bill {bid}", f"remit to ...{g0.remit_to_account_last4}, status {g0.status}", f"...{s.bank_account_last4}"),
            ("suppliers.csv", vname, f"bank on file ...{s.bank_account_last4} verified {s.bank_verified_on}", "")],
            party=vname, category="AP→Vendors", explanation="Bank change came by email and was never verified by phone.", action="payment_hold", bill_id=bid, supplier=sid)
    po_ref = g0.po_ref.strip()
    for r in g.itertuples():
        if r.line_type == "FREIGHT":
            amt = D(r.amount)
            if s is None or amt <= 0: continue
            pt = D(po[po.po_no == po_ref].po_total.iloc[0]) if (po.po_no == po_ref).any() else None
            bad = s.freight_terms == "ALWAYS_PREPAID" or (s.freight_terms == "PREPAID_OVER" and pt is not None and pt >= D(s.free_freight_min))
            if bad:
                add(f"FREIGHT-{bid}", "Freight billed against terms", amt, mon, f"{vname} billing freight on prepaid orders", [
                    ("supplier_bills.csv", f"bill {bid}, line {r.line_no}", f"freight ${amt}", "$0.00"),
                    ("suppliers.csv", vname, f"terms {s.freight_terms} (free over ${s.free_freight_min})", ""),
                    ("purchase_orders.csv", po_ref, f"PO total ${pt}" if pt is not None else "PO not found", "")],
                    party=vname, category="AP→Vendors", explanation="Supplier terms say freight is prepaid for this order.", action="supplier_dispute", bill_id=bid, sku="FREIGHT")
            continue
        lines = po_lines.get((po_ref, r.supplier_item_code)) or []
        sku = code_to_sku.get(r.supplier_item_code, "")
        if not lines:
            continue
        pl = lines[0]
        bq, bc = r.cq, C(r.cc)
        if bc - D(pl.unit_cost) >= Decimal("0.01"):
            amt = C((bc - D(pl.unit_cost)) * bq)
            add(f"OVERPO-{bid}-{sku}", "Supplier billed above PO price", amt, mon, f"{vname} billing above PO prices", [
                ("supplier_bills.csv", f"bill {bid}, line {r.line_no}", f"unit_cost ${bc} x {bq} cases", f"${pl.unit_cost} a case"),
                ("purchase_orders.csv", f"{po_ref}, line {pl.po_line}", f"unit_cost ${pl.unit_cost}; {sum(x.qa for x in lines)} cases accepted", "")],
                party=vname, category="AP→Vendors", explanation="The PO price holds even if the supplier raised prices later.", action="supplier_dispute", bill_id=bid, sku=sku, po_no=po_ref)
_heads = bills.drop_duplicates("bill_id").copy()
_heads["norm"] = _heads.supplier_invoice_no.str.upper().str.replace(r"[^A-Z0-9]", "", regex=True)
DUP_BILLS = set()
for _, g in _heads.groupby(["vendor", "norm"]):
    if len(g) > 1: DUP_BILLS |= set(g.sort_values("bill_date").bill_id.iloc[1:])
for _, g in _heads[_heads.po_ref != ""].groupby(["vendor", "po_ref", "bill_total"]):
    if len(g) > 1: DUP_BILLS |= set(g.sort_values("bill_date").bill_id.iloc[1:])
billed = {}
for r in bills[(bills.line_type == "ITEM") & (~bills.bill_id.isin(DUP_BILLS))].itertuples():
    billed.setdefault((r.po_ref.strip(), r.supplier_item_code), []).append(r)
for (pref, code), rows in billed.items():
    lines = po_lines.get((pref, code)) or []
    if not lines: continue
    acc = sum(x.qa for x in lines)
    bq = sum(x.cq for x in rows)
    if bq - acc >= 1:
        last = rows[-1]; s = sup_by_vendor.get(last.vendor)
        vname = s.supplier_name if s is not None else last.vendor
        cost = D(lines[0].unit_cost)
        sku = code_to_sku.get(code, "")
        add(f"OVERQTY-{last.bill_id}-{sku}", "Supplier billed more cases than accepted", C(cost * (bq - acc)), month_of(dt(last.bill_date)), f"{vname} billing for refused or missing cases", [
            ("supplier_bills.csv", f"bill {last.bill_id}", f"{bq:g} cases billed on {pref}", f"{acc} cases"),
            ("purchase_orders.csv", pref, f"received {sum(int(float(x.qty_received or 0)) for x in lines)}, damaged {sum(int(float(x.qty_damaged or 0)) for x in lines)}, accepted {acc}", "")],
            party=vname, category="AP→Vendors", explanation="Pay only for accepted cases.", action="supplier_dispute", bill_id=last.bill_id, sku=sku, po_no=pref)
# duplicate supplier invoice entered twice
for bid in sorted(DUP_BILLS):
    r = _heads[_heads.bill_id == bid].iloc[0]
    v = r.vendor
    same = _heads[(_heads.vendor == v) & ((_heads.norm == r.norm) | ((_heads.po_ref == r.po_ref) & (_heads.bill_total == r.bill_total))) & (_heads.bill_id != bid)].sort_values("bill_date")
    first = same.iloc[0]
    if True:
        s = sup_by_vendor.get(v); vname = s.supplier_name if s is not None else v
        add(f"DUPBILL-{r.bill_id}", "Supplier invoice entered twice", D(r.bill_total), month_of(dt(r.bill_date)), "Supplier invoices entered twice", [
            ("supplier_bills.csv", f"bill {first.bill_id}", f"invoice {first.supplier_invoice_no} ${first.bill_total} {first.bill_date}", ""),
            ("supplier_bills.csv", f"bill {r.bill_id}", f"invoice {r.supplier_invoice_no} ${r.bill_total} {r.bill_date}", "Enter each supplier invoice once")],
            party=vname, category="AP→Vendors", explanation="Same supplier invoice in QuickBooks twice.", action="payment_hold", bill_id=r.bill_id)

# ---------------- inbox ----------------
ib = inbox.copy()
ib["t"] = pd.to_datetime(ib.sent_at, errors="coerce")
internal_dom = "northlinesupply.com"
cust_emails = set(cust.contact_email.str.lower()) | set(cust.ap_email.str.lower())
sup_domains = {e.split("@")[-1] for e in list(sups.orders_email.str.lower()) + list(sups.billing_email.str.lower()) if "@" in e}
replied = set(ib.in_reply_to) - {""}
by_thread = {k: g.sort_values("t") for k, g in ib.groupby("thread_id")}
THANKS = re.compile(r"^\s*(thanks|thank you|thx|great, thanks|perfect,? thanks|got it,? thanks)[\s\S]{0,60}$", re.I)
for r in ib.itertuples():
    if r.direction != "inbound": continue
    fe = r.from_email.lower()
    is_cust = fe in cust_emails
    # fake bank change
    if re.search(r"bank|remit|account ending|routing", r.subject + " " + r.body, re.I) and re.search(r"updated banking|bank details|new bank|remit all payments", r.subject + " " + r.body, re.I):
        dom = fe.split("@")[-1]
        if dom not in sup_domains:
            vend = next((s for s in sups.itertuples() if s.supplier_name.split()[0].lower() in (r.subject + r.body).lower()), None)
            add(f"PHISH-{r.message_id}", "Fake bank change email", 0, month_of(r.t.date()), f"Bank change request from {dom} (not the supplier's domain)", [
                ("inbox.csv", f"message {r.message_id}", f"From {fe}: {r.subject}", "Verify by calling the number on file"),
                ("suppliers.csv", vend.supplier_name if vend is not None else "supplier", f"emails @{(vend.billing_email.split('@')[-1]) if vend is not None else '?'}, phone {vend.phone if vend is not None else ''}", "")],
                party=vend.supplier_name if vend is not None else dom, category="Inbox→AP", explanation="Lookalike domain asking to change bank details; AP updated it without a call.", action="payment_hold", message_id=r.message_id)
        continue
    if not is_cust: continue
    body = r.body.strip()
    if THANKS.match(body) or (len(body) < 80 and re.search(r"\bthank", body, re.I) and "?" not in body): continue
    th = by_thread.get(r.thread_id)
    later = th[(th.t > r.t) & (th.direction == "outbound")] if th is not None else []
    if len(later):
        continue  # answered (late replies are not flagged; the problem is an email that never got an answer)
    else:
        if add_bd(r.t.date(), 1) >= CUTOFF: continue
        late_txt = "no reply in the thread"
    c = next((x for x in cust.itertuples() if fe in (x.contact_email.lower(), x.ap_email.lower())), None)
    add(f"NOREPLY-{r.message_id}", "Customer email with no reply", 0, month_of(r.t.date()), "Unanswered customer email", [
        ("inbox.csv", f"message {r.message_id}", f"{c.customer_name if c is not None else fe}: {r.subject} ({r.sent_at})", f"A reply by the end of {add_bd(r.t.date(),1):%b %d}"),
        ("inbox.csv", f"thread {r.thread_id}", late_txt, "")],
        party=c.customer_name if c is not None else fe, category="Inbox→Customer", explanation=f"Asked on {r.t:%b %d}; {late_txt}.", action="customer_reply", message_id=r.message_id)

# promised credit not issued within 5 business days
for r in ib[(ib.direction == "outbound")].itertuples():
    m = re.search(r"issue a credit of \$([\d,]+\.\d{2}).*?invoice #?(\d{7})", r.body, re.I | re.S)
    if not m: continue
    amt, no = D(m.group(1)), m.group(2)
    due = add_bd(r.t.date(), 5)
    got = cms[(cms.invoice_no == no) & (cms.date.apply(lambda x: dt(x) is not None and dt(x) <= due))]
    if len(got) or due >= CUTOFF: continue
    cname = invl[invl.invoice_no == no].customer.iloc[0] if (invl.invoice_no == no).any() else ""
    add(f"CREDIT-{r.message_id}", "Promised credit not issued", -amt, month_of(r.t.date()), "Credit promised by email never issued", [
        ("inbox.csv", f"message {r.message_id}", f"Promised ${amt} credit on invoice {no} ({r.sent_at})", f"Credit memo by {due:%b %d}"),
        ("invoices.csv", f"invoice {no}", "No credit memo against this invoice", "")],
        party=cname, category="Inbox→Billing", explanation=f"We told the customer a ${amt} credit was coming.", action="credit_memo", invoice_no=no, message_id=r.message_id)

os.makedirs(OUT, exist_ok=True)
FCOLS = ["problem", "delivery_id", "invoice_no", "sku", "po_no", "bill_id", "supplier", "message_id", "amount", "month", "cause", "finding_id", "party", "category", "explanation", "action_type"]
with open(os.path.join(OUT, "findings.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=FCOLS); w.writeheader(); w.writerows(findings)
with open(os.path.join(OUT, "evidence.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["finding_id", "file", "record", "shows", "expected"]); w.writeheader(); w.writerows(evidence)
df = pd.DataFrame(findings)
df["amt"] = df.amount.astype(float)
print(f"cutoff {CUTOFF} · {len(df)} findings · ${df.amt.sum():,.2f} net")
print(df.groupby("problem").amt.agg(["count", "sum"]).sort_values("count", ascending=False).to_string())
