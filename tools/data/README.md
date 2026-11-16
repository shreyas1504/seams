# Seams test dataset (mock Northline Supply)

Built to test the Seams app today and to be swapped for the real case data tomorrow. All data is fictional.
As-of date: **2026-11-13**. Overdue = open and 30+ days past due.

## Folders
- `clean/`: canonical headers (match the Seams canonical fields). Import these first.
- `messy_headers/`: the SAME data with renamed headers, shuffled column order and MM/DD/YYYY dates.
  Import these through the column mapper; totals must be identical. This is the dress rehearsal for tomorrow's swap.
- `twist_returns_log.csv` (in both folders): upload mid-demo to test the Twist Proposer.
- `reference_checks.py`: independent implementation of every rule. `python3 reference_checks.py clean` (add `--twist` after the returns log).
  The analyst can point it at tomorrow's data after renaming columns to the canonical names below.
- `answer_key_before_twist.txt`, `answer_key_after_twist.txt`: full flag lists.
- `build_dataset.py`: regenerates everything (fixed random seed).

## Expected results
| | Before twist | After twist |
|---|---|---|
| Recoverable | 17 issues, $18,280.94 | 17 issues, $18,376.03 |
| Overdue cash | 5 invoices, $13,977.99 | 5 invoices, $13,977.99 |
| Credits Northline owes customers | 2, $180.00 | 3, $350.00 (adds Greenpoint Bistro $170.00: 5 returned napkin cases, no credit memo) |
| Checked, not a leak | 13 | 16 (adds: returned units explain a short-bill; 2 returns correctly credited) |
| Patterns | 4 | 5 (adds Hudson Yards Cowork: 3 recoverable issues) |

Twist effect (3 changes): Chelsea Dental short-bill ($136.11) clears because 3 units were returned; duplicate credit memo CM-305 / cm305 to Hudson Yards Cowork adds a $231.20 over-credit (recoverable); Greenpoint Bistro returned 5 napkin cases on a paid invoice with no credit memo, so Northline owes a $170.00 credit (both ways, again).

Patterns before the twist: glove price not updated after 9/15 (4 invoices, 4 customers, $1,440.00); Lenox Hill Hospital 3 recoverable issues ($2,407.90); freight not passed on to rebill customers (3, $404.11); duplicate payments differ only by invoice-number formatting (2 vendors, $9,608.40).

| Rule | Seam | Count | $ |
|---|---|---|---|
| Duplicate vendor payment | AP to Vendors | 2 | 9,608.40 |
| Shipped, not invoiced | Warehouse to Billing | 3 | 3,970.22 |
| Below contract price | CRM to Billing | 5 | 2,033.00 |
| Vendor over PO | AP to Vendors | 2 | 1,752.00 |
| Short-billed | Warehouse to Billing | 2 | 513.21 |
| Freight not rebilled | Warehouse to Billing | 3 | 404.11 |
| Overdue receivable | Billing to Customer | 5 | 13,977.99 |
| Billed above contract (credit we owe) | CRM to Billing | 2 | 180.00 (Tribeca Grill 120.00, credit-only letter; Chelsea Dental 60.00, mixed letter) |

## The 13 traps (must NOT flag)
1. Sample shipment, no invoice
2. Replacement shipment, no invoice
3. Invoice with blank order ref that matches one shipment on customer, SKU, qty, date
4. Glove invoice at 18.50 dated 9/10, before the 9/15 price increase
5. Order invoiced in two parts (35 + 25 = 60)
6. Freight not billed to a customer whose contract does not rebill freight
7. Invoice only 6 days late
8. Order ref written "so 1990" (digits-only match to SO-1990)
9. Warehouse name variants (Lenox Hill Hosp., Astoria Medical Grp, TRIBECA GRILL LLC)
10. Monthly rent: same vendor and amount, different invoice numbers
11. Weekly freight: same vendor and amount, different invoice numbers
12. Vendor bill $2.40 over PO (under max($25, 1%))
13. Glove invoice at 21.00 dated 9/15 for goods shipped 9/14: invoice-date price applies, so not overbilled

Built-in format mess: order refs appear as SO-1043 / SO1043 / 1043; duplicate vendor invoices differ only in case and punctuation (HP-7781 vs hp7781, AP/2210 vs AP-2210).

## Swapping in the real data tomorrow
1. Reset the app (clears data, keeps rules and settings).
2. Import each real CSV through the mapper; confirm every column maps to a canonical field below. Unmapped required fields = turn that rule off.
3. Set the as-of date and thresholds in Settings to the case's values.
4. Analyst runs Prompt 0 in Claude (and/or renames columns and runs `reference_checks.py`) and diffs against the app.

## Column dictionary (canonical field, messy-test header)
| File | Canonical field | Messy header |
|---|---|---|
| crm_contracts.csv | `contract_id` | Contract # |
| crm_contracts.csv | `customer_name` | Account Name |
| crm_contracts.csv | `sku` | Item Code |
| crm_contracts.csv | `contract_price` | Agreed Price ($) |
| crm_contracts.csv | `start_date` | Effective From |
| crm_contracts.csv | `end_date` | Effective To |
| crm_contracts.csv | `rebill_freight` | Pass-through Freight? |
| crm_contracts.csv | `payment_terms_days` | Net Terms |
| crm_contracts.csv | `billing_email` | AP Contact Email |
| warehouse_shipments.csv | `shipment_id` | Ship ID |
| warehouse_shipments.csv | `order_no` | Sales Order |
| warehouse_shipments.csv | `ship_to` | Ship To |
| warehouse_shipments.csv | `sku` | Item |
| warehouse_shipments.csv | `qty` | Qty Shipped |
| warehouse_shipments.csv | `ship_date` | Ship Dt |
| warehouse_shipments.csv | `ship_type` | Shipment Type |
| warehouse_shipments.csv | `freight_cost` | Carrier Cost |
| billing_invoices.csv | `invoice_no` | Inv # |
| billing_invoices.csv | `order_ref` | Customer PO / SO Ref |
| billing_invoices.csv | `customer` | Bill To |
| billing_invoices.csv | `sku` | Product |
| billing_invoices.csv | `qty` | Qty Billed |
| billing_invoices.csv | `unit_price` | Rate |
| billing_invoices.csv | `freight_billed` | Shipping Charged |
| billing_invoices.csv | `amount` | Invoice Total |
| billing_invoices.csv | `invoice_date` | Inv Date |
| billing_invoices.csv | `due_date` | Due |
| billing_invoices.csv | `status` | Payment Status |
| billing_invoices.csv | `paid_date` | Date Paid |
| ap_bills.csv | `bill_id` | Bill ID |
| ap_bills.csv | `vendor` | Supplier |
| ap_bills.csv | `vendor_invoice_no` | Supplier Inv No |
| ap_bills.csv | `bill_date` | Bill Dt |
| ap_bills.csv | `amount` | Amount Paid |
| ap_bills.csv | `po_no` | PO Number |
| ap_bills.csv | `po_amount` | PO Value |
| ap_bills.csv | `payment_id` | Payment Ref |
| ap_bills.csv | `paid_date` | Payment Dt |
| twist_returns_log.csv | `return_id` | RMA # |
| twist_returns_log.csv | `order_ref` | Orig Order |
| twist_returns_log.csv | `customer` | Customer Name |
| twist_returns_log.csv | `sku` | SKU |
| twist_returns_log.csv | `qty_returned` | Units Back |
| twist_returns_log.csv | `return_date` | RMA Date |
| twist_returns_log.csv | `credit_memo_no` | Credit Memo |
| twist_returns_log.csv | `credit_amount` | Credit $ |
| twist_returns_log.csv | `note` | Reason |
