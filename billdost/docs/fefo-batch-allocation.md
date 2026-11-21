# FEFO Batch Allocation: Stage 5 Follow-Up Spec

Status: Implemented in migration 0016 (Stage 5) and verified by the
PG harness in `supabase/tests/` (20 assertion groups, including the
six FEFO cases listed under Verification below, all passing). Batch
management UI, expiry alerts and write-off shipped in Stage 4
(migration 0015 RPCs `add_product_batch_tx` and
`write_off_batch_tx`, products router batch procedures, Inventory >
Batch & Expiry tab). Billing now allocates batches FEFO for
track_expiry products on top of the product level `stock_qty`
deduction, cancellation restores the exact batches through the new
`invoice_batch_allocations` ledger, and `convert_quotation_tx`
carries the same FEFO block so converted bills track batches
identically. This document remains as the spec the migration was
built from.

## Why it was deferred

`create_invoice_tx` (migration 0006) is the money path: totals,
payments, stock and the stock ledger move in one transaction and the
full local PG assertion suite proves it. FEFO touches the item loop
of that function plus the cancellation path, so it ships separately
with its own assertions, per the Stage 4 instruction.

## The change

### 1. New migration (0016_fefo_batch_allocation.sql)

a) Allocation ledger table (needed so cancellation can restore the
   exact batches a sale consumed):

```sql
create table public.invoice_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_item_id uuid not null references public.invoice_items(id) on delete restrict,
  batch_id uuid not null references public.product_batches(id) on delete restrict,
  qty numeric(12,3) not null check (qty > 0),
  created_at timestamptz not null default now()
);
-- RLS: select for shop members, no direct writes (RPC only), same
-- pattern as the other billing tables. Grants in the same file.
```

b) `create_invoice_tx`: inside the existing item loop, immediately
   after the `products.stock_qty` update and `inventory_logs` SALE
   insert for that item, add FEFO allocation ONLY when
   `v_product.track_expiry is true`:

   - Select the product's batches with `qty > 0` and
     (`expiry_date is null` or `expiry_date >= current_date`),
     ordered by `expiry_date asc nulls last, created_at asc`,
     `for update`. Expired batches are deliberately excluded:
     selling expired stock is not allowed; expired qty leaves only
     through `write_off_batch_tx`.
   - Walk the batches taking `least(batch.qty, remaining)` until the
     line quantity is covered or batches run out. For each take:
     decrement `product_batches.qty`, insert one
     `invoice_batch_allocations` row, and insert one
     `inventory_logs` row with `batch_id` set, type 'SALE',
     quantity_change negative, notes 'FEFO batch <batch_no>'.
   - If batches run out before the line is covered, allocate what
     exists and continue the sale. Product stock is the billing
     truth (it was already checked and deducted above); batches are
     a tracking layer and must never block or fail a sale.
   - Set `invoice_items.batch_id` (the column already exists) only
     when exactly one batch covered the whole line; otherwise leave
     it null and let the allocations table carry the split.

c) Cancellation path (`cancel_invoice_tx` in migration 0006, plus
   any returns flow that restores stock): for each allocation row of
   the invoice, add the qty back to that batch and write a
   compensating `inventory_logs` row (type 'REVERSAL', batch_id set).
   Products with `track_expiry` false have no allocation rows, so
   their behaviour is unchanged.

### 2. What does not change

- No payload change: the client sends the same invoice payload.
- No totals, tax, payment or numbering change.
- Products without `track_expiry`, and shops that never use batches,
  see zero behaviour change.

## Verification required before it ships

Re-run the full local PG harness (all migrations 0001-0016 apply
clean, every prior assertion suite passes unchanged), plus new
assertions:

1. Single batch covers a line: batch qty drops by the line qty,
   `invoice_items.batch_id` set, one allocation row.
2. Line split across two batches: earliest expiry drains first,
   second batch takes the remainder, two allocation rows,
   `invoice_items.batch_id` null.
3. Expired batch present: skipped by allocation, qty untouched.
4. Batches total less than the line: sale succeeds, partial
   allocation only.
5. `track_expiry` false product with batches present: no allocation
   rows, batch qty untouched.
6. Cancel the invoice from case 2: both batches restored to their
   original qty, REVERSAL log rows written.
