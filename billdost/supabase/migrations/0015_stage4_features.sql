-- 0015: Stage 4 feature gaps. Everything here is additive: new columns
-- with defaults, new tables, and NEW RPCs. The proven money RPCs from
-- 0006/0013 are not modified. RLS and grants ship in the same file, per
-- the post 30 Oct 2026 Data API rule.
--
-- Gaps filled, by blueprint spec:
--   D3  shops.thermal_width, shops.print_upi_qr (paper size + QR toggle)
--   D20 shops.low_stock_alerts (owner digest toggle),
--       products.low_stock_alerted_at (digest stamp)
--   D7  customers.reminders_paused (per-customer reminder opt-out)
--   D11 expenses.mode, expenses.status, expense_categories table
--   D5  product_batches.mrp (batch MRP alongside cost price)
--   C1  whatsapp_sends.kind / quotation_id / customer_id, so quotation,
--       reminder and low-stock sends share the one audit table
--   Admin Portal groundwork: client_errors, the client-side error log
--   the personalized error fallback posts to (issue centre feed).

alter table public.shops
  add column thermal_width int not null default 80
    check (thermal_width in (58, 80)),
  add column print_upi_qr boolean not null default true,
  add column low_stock_alerts boolean not null default true;

alter table public.products
  add column low_stock_alerted_at timestamptz;

alter table public.customers
  add column reminders_paused boolean not null default false;

alter table public.expenses
  add column mode text not null default 'cash',
  add column status text not null default 'active'
    check (status in ('active', 'cancelled'));

alter table public.product_batches
  add column mrp numeric(12,2);

alter table public.whatsapp_sends
  add column kind text not null default 'invoice'
    check (kind in ('invoice', 'quotation', 'reminder', 'low_stock', 'test')),
  add column quotation_id uuid references public.quotations(id) on delete set null,
  add column customer_id uuid references public.customers(id) on delete set null;

create index whatsapp_sends_quotation_idx
  on public.whatsapp_sends (quotation_id) where quotation_id is not null;
create index whatsapp_sends_customer_idx
  on public.whatsapp_sends (customer_id) where customer_id is not null;

-- ------------------------------------------------------------ categories
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

alter table public.expense_categories enable row level security;

create policy expense_categories_select_member on public.expense_categories for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy expense_categories_insert_manager on public.expense_categories for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy expense_categories_delete_manager on public.expense_categories for delete to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));

grant select, insert, update, delete on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;

-- ---------------------------------------------------------- client errors
-- Written only by the service role from POST /api/client-errors (the
-- route resolves the session best-effort and caps payloads). Reads are
-- manager/owner of the owning shop; rows without a shop are visible to
-- nobody through the API and exist for the future Admin Portal, which
-- reads with the service role.
create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  route text,
  digest text,
  error_name text,
  message text,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index client_errors_shop_created_idx
  on public.client_errors (shop_id, created_at desc);
create index client_errors_digest_idx
  on public.client_errors (digest, created_at desc);

alter table public.client_errors enable row level security;

create policy client_errors_select_manager on public.client_errors for select to authenticated
  using (shop_id is not null and app.is_shop_member(shop_id, array['owner', 'manager']));

grant select, insert, update, delete on public.client_errors to authenticated;
grant all on public.client_errors to service_role;

-- ------------------------------------------------------------ batch RPCs
-- New functions only. create_invoice_tx is NOT changed in Stage 4:
-- FEFO allocation inside it is specified in docs/fefo-batch-allocation.md
-- and lands as its own verified change (Stage 5 follow-up).

create or replace function public.add_product_batch_tx(
  p_product_id uuid,
  p_batch_no text,
  p_expiry_date date,
  p_mrp numeric,
  p_cost_price numeric,
  p_qty numeric,
  p_actor uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_product record;
  v_batch_id uuid;
  v_prev numeric;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_product.shop_id, v_actor, array['owner', 'manager']);
  if p_qty is null or p_qty <= 0 then
    raise exception 'batch quantity must be positive' using errcode = '23514';
  end if;
  if p_batch_no is null or btrim(p_batch_no) = '' then
    raise exception 'batch number required' using errcode = '23514';
  end if;

  insert into public.product_batches (
    shop_id, product_id, batch_no, expiry_date, mrp, cost_price, qty
  ) values (
    v_product.shop_id, p_product_id, btrim(p_batch_no), p_expiry_date,
    p_mrp, p_cost_price, p_qty
  )
  on conflict (shop_id, product_id, batch_no) do update
    set qty = public.product_batches.qty + excluded.qty,
        expiry_date = coalesce(excluded.expiry_date, public.product_batches.expiry_date),
        mrp = coalesce(excluded.mrp, public.product_batches.mrp),
        cost_price = coalesce(excluded.cost_price, public.product_batches.cost_price)
  returning id into v_batch_id;

  v_prev := v_product.stock_qty;
  if v_prev is not null then
    update public.products
    set stock_qty = v_prev + p_qty,
        low_stock_alerted_at = case
          when low_stock_alert is not null and v_prev + p_qty > low_stock_alert
          then null else low_stock_alerted_at end
    where id = p_product_id;
  end if;

  insert into public.inventory_logs (
    shop_id, product_id, batch_id, type, quantity_change,
    previous_stock, new_stock, notes, created_by
  ) values (
    v_product.shop_id, p_product_id, v_batch_id, 'STOCK_IN', p_qty,
    v_prev, case when v_prev is null then null else v_prev + p_qty end,
    'Batch ' || btrim(p_batch_no) || ' add hua', v_actor
  );

  return v_batch_id;
end;
$$;

create or replace function public.write_off_batch_tx(
  p_batch_id uuid,
  p_actor uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_batch record;
  v_product record;
begin
  select * into v_batch from public.product_batches where id = p_batch_id for update;
  if not found then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_batch.shop_id, v_actor, array['owner', 'manager']);
  if v_batch.qty <= 0 then
    raise exception 'batch already empty' using errcode = '23514';
  end if;

  select * into v_product from public.products where id = v_batch.product_id for update;

  update public.product_batches set qty = 0 where id = p_batch_id;

  if v_product.stock_qty is not null then
    update public.products
    set stock_qty = greatest(v_product.stock_qty - v_batch.qty, 0)
    where id = v_product.id;
  end if;

  insert into public.inventory_logs (
    shop_id, product_id, batch_id, type, quantity_change,
    previous_stock, new_stock, notes, created_by
  ) values (
    v_batch.shop_id, v_batch.product_id, p_batch_id, 'EXPIRY_WRITEOFF',
    -v_batch.qty, v_product.stock_qty,
    case when v_product.stock_qty is null then null
         else greatest(v_product.stock_qty - v_batch.qty, 0) end,
    'Batch ' || v_batch.batch_no || ' expiry write-off', v_actor
  );
end;
$$;

grant execute on function public.add_product_batch_tx(uuid, text, date, numeric, numeric, numeric, uuid) to authenticated;
revoke execute on function public.add_product_batch_tx(uuid, text, date, numeric, numeric, numeric, uuid) from anon, public;
grant execute on function public.add_product_batch_tx(uuid, text, date, numeric, numeric, numeric, uuid) to service_role;
grant execute on function public.write_off_batch_tx(uuid, uuid) to authenticated;
revoke execute on function public.write_off_batch_tx(uuid, uuid) from anon, public;
grant execute on function public.write_off_batch_tx(uuid, uuid) to service_role;

-- ------------------------------------------------- udhaar payment (D7)
-- Allocates one payment across the customer's oldest unpaid active
-- bills, reusing record_payment_tx per bill so per-bill status, the
-- payments ledger and the customer stats trigger stay exactly as the
-- proven path maintains them. Opening balance is NOT touched here: it
-- has no bill to settle against, and pretending otherwise would corrupt
-- per-bill truth. Returns the allocation detail as jsonb.
create or replace function public.record_udhaar_payment_tx(
  p_customer_id uuid,
  p_amount numeric,
  p_mode text,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_customer record;
  v_remaining numeric := p_amount;
  v_bill record;
  v_pay numeric;
  v_allocated jsonb := '[]'::jsonb;
  v_count int := 0;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_customer.shop_id, v_actor, array['owner', 'manager', 'cashier']);
  if p_amount is null or p_amount <= 0 then
    raise exception 'payment amount out of range' using errcode = '23514';
  end if;

  for v_bill in
    select id, balance_due from public.invoices
    where shop_id = v_customer.shop_id
      and customer_id = p_customer_id
      and status = 'active'
      and balance_due > 0
    order by invoice_date asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_pay := least(v_remaining, v_bill.balance_due);
    perform public.record_payment_tx(v_bill.id, v_pay, coalesce(p_mode, 'cash'), v_actor);
    v_allocated := v_allocated || jsonb_build_object(
      'invoice_id', v_bill.id, 'amount', v_pay);
    v_remaining := v_remaining - v_pay;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'no outstanding bills for customer' using errcode = '23514';
  end if;

  return jsonb_build_object(
    'allocated', v_allocated,
    'allocated_total', p_amount - v_remaining,
    'unallocated', v_remaining,
    'bills_touched', v_count
  );
end;
$$;

grant execute on function public.record_udhaar_payment_tx(uuid, numeric, text, uuid) to authenticated;
revoke execute on function public.record_udhaar_payment_tx(uuid, numeric, text, uuid) from anon, public;
grant execute on function public.record_udhaar_payment_tx(uuid, numeric, text, uuid) to service_role;
