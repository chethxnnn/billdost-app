-- 0016: FEFO batch allocation (docs/fefo-batch-allocation.md, Stage 5).
-- Billing already deducts the product level stock_qty in 0006. This
-- migration adds the batch tracking layer on top of it: a sale of a
-- track_expiry product now also drains its batches first expiry first
-- out (FEFO), recorded in a new allocation ledger so that cancelling
-- the invoice can restore the exact batches the sale consumed.
-- Products without track_expiry, and shops that never use batches, see
-- zero behaviour change. Partial allocation never fails a sale: the
-- product stock check in the original functions stays the only gate.
-- convert_quotation_tx gets the same FEFO block as create_invoice_tx
-- because a converted quotation creates an invoice and deducts stock;
-- without it, batch tracked products sold through a quotation would
-- silently skip batch deduction.

-- ------------------------------------------------- allocation ledger
create table public.invoice_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_item_id uuid not null references public.invoice_items(id) on delete restrict,
  batch_id uuid not null references public.product_batches(id) on delete restrict,
  qty numeric(12,3) not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index invoice_batch_allocations_invoice_idx
  on public.invoice_batch_allocations (invoice_id);
create index invoice_batch_allocations_batch_idx
  on public.invoice_batch_allocations (batch_id);

-- RLS: select for shop members only. No insert, update or delete
-- policies: writes happen only inside the security definer RPCs below.
alter table public.invoice_batch_allocations enable row level security;

create policy invoice_batch_allocations_select_member
  on public.invoice_batch_allocations for select to authenticated
  using (shop_id in (select app.current_shop_ids()));

grant select on public.invoice_batch_allocations to authenticated;
grant all on public.invoice_batch_allocations to service_role;

-- ------------------------------------------------------ create_invoice_tx
-- Full body from 0006, with FEFO added inside the item loop: the
-- inserted invoice_items id is captured, and after the product level
-- stock update and SALE log, a track_expiry product allocates its line
-- quantity across its unexpired batches, earliest expiry first.
create or replace function public.create_invoice_tx(
  p_shop_id uuid, p_actor uuid, p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_totals jsonb := p_payload -> 'totals';
  v_customer_id uuid := nullif(p_payload ->> 'customer_id', '')::uuid;
  v_total numeric := (v_totals ->> 'total')::numeric;
  v_amount_paid numeric := coalesce((p_payload ->> 'amount_paid')::numeric, 0);
  v_invoice_id uuid;
  v_invoice_number text;
  v_item jsonb;
  v_product record;
  v_items_taxable numeric := 0;
  v_items_tax numeric := 0;
  v_invoice_item_id uuid;
  v_remaining numeric;
  v_batch record;
  v_take numeric;
  v_alloc_count int;
  v_single_batch_id uuid;
begin
  perform app.assert_shop_role(p_shop_id, v_actor, array['owner', 'manager', 'cashier']);

  -- Arithmetic re-validation: header must equal the sum of its lines.
  select coalesce(sum((i ->> 'taxable_amt')::numeric), 0),
         coalesce(sum((i ->> 'tax_amt')::numeric), 0)
  into v_items_taxable, v_items_tax
  from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as i;

  if abs(v_items_taxable - (v_totals ->> 'taxable_amt')::numeric) > 0.01
     or abs(v_items_tax - ((v_totals ->> 'cgst_amt')::numeric
                         + (v_totals ->> 'sgst_amt')::numeric
                         + (v_totals ->> 'igst_amt')::numeric)) > 0.01
     or abs(v_total - ((v_totals ->> 'taxable_amt')::numeric
                     + (v_totals ->> 'cgst_amt')::numeric
                     + (v_totals ->> 'sgst_amt')::numeric
                     + (v_totals ->> 'igst_amt')::numeric
                     + (v_totals ->> 'round_off_amt')::numeric)) > 0.01 then
    raise exception 'totals do not reconcile with items' using errcode = '23514';
  end if;

  if v_amount_paid < 0 or v_amount_paid > v_total then
    raise exception 'amount_paid out of range' using errcode = '23514';
  end if;

  -- Customer: validate ownership, or find-or-create by phone in this shop.
  if v_customer_id is not null then
    if not exists (
      select 1 from public.customers
      where id = v_customer_id and shop_id = p_shop_id
    ) then
      raise exception 'customer does not belong to this shop' using errcode = '42501';
    end if;
  elsif coalesce(p_payload ->> 'customer_phone', '') <> '' then
    insert into public.customers (shop_id, name, phone, address, gstin, state_code)
    values (
      p_shop_id,
      p_payload ->> 'customer_name',
      p_payload ->> 'customer_phone',
      nullif(p_payload ->> 'customer_address', ''),
      nullif(p_payload ->> 'customer_gstin', ''),
      nullif(p_payload ->> 'customer_state_code', '')
    )
    on conflict (shop_id, phone) where phone is not null and phone <> '' do nothing
    returning id into v_customer_id;
    if v_customer_id is null then
      select id into v_customer_id from public.customers
      where shop_id = p_shop_id and phone = p_payload ->> 'customer_phone';
    end if;
  end if;

  -- Atomic number: the single UPDATE serialises concurrent creators.
  update public.shops
  set invoice_counter = invoice_counter + 1
  where id = p_shop_id
  returning invoice_prefix || '-' || invoice_counter into v_invoice_number;

  insert into public.invoices (
    shop_id, customer_id, invoice_number, customer_name, customer_phone,
    customer_address, customer_gstin, customer_state_code, invoice_date,
    due_date, subtotal, discount_pct, discount_amt, taxable_amt, cgst_amt,
    sgst_amt, igst_amt, round_off_amt, place_of_supply_state_code,
    is_interstate, total, amount_paid, balance_due, payment_status,
    payment_mode, paid_at, include_upi_qr, notes, source
  ) values (
    p_shop_id, v_customer_id, v_invoice_number, p_payload ->> 'customer_name',
    nullif(p_payload ->> 'customer_phone', ''),
    nullif(p_payload ->> 'customer_address', ''),
    nullif(p_payload ->> 'customer_gstin', ''),
    nullif(p_payload ->> 'customer_state_code', ''),
    coalesce((p_payload ->> 'invoice_date')::date, current_date),
    nullif(p_payload ->> 'due_date', '')::date,
    (v_totals ->> 'subtotal')::numeric,
    coalesce((p_payload ->> 'discount_pct')::numeric, 0),
    (v_totals ->> 'discount_amt')::numeric,
    (v_totals ->> 'taxable_amt')::numeric,
    (v_totals ->> 'cgst_amt')::numeric,
    (v_totals ->> 'sgst_amt')::numeric,
    (v_totals ->> 'igst_amt')::numeric,
    (v_totals ->> 'round_off_amt')::numeric,
    nullif(p_payload ->> 'place_of_supply_state_code', ''),
    coalesce((p_payload ->> 'is_interstate')::boolean, false),
    v_total, v_amount_paid, v_total - v_amount_paid,
    case when v_amount_paid <= 0 then 'unpaid'
         when v_amount_paid >= v_total then 'paid'
         else 'partial' end,
    nullif(p_payload ->> 'payment_mode', ''),
    case when v_amount_paid >= v_total and v_total > 0 then now() else null end,
    coalesce((p_payload ->> 'include_upi_qr')::boolean, true),
    nullif(p_payload ->> 'notes', ''),
    coalesce(nullif(p_payload ->> 'source', ''), 'app')
  ) returning id into v_invoice_id;

  -- Items, stock deduction and the stock ledger, all in this transaction.
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    insert into public.invoice_items (
      invoice_id, product_id, name, hsn_code, unit, quantity, unit_price,
      making_charge, tax_rate, discount_amt, taxable_amt, tax_amt, total, sort_order
    ) values (
      v_invoice_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      v_item ->> 'name',
      nullif(v_item ->> 'hsn_code', ''),
      coalesce(nullif(v_item ->> 'unit', ''), 'piece'),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit_price')::numeric,
      coalesce((v_item ->> 'making_charge')::numeric, 0),
      coalesce((v_item ->> 'tax_rate')::numeric, 0),
      coalesce((v_item ->> 'discount_amt')::numeric, 0),
      (v_item ->> 'taxable_amt')::numeric,
      (v_item ->> 'tax_amt')::numeric,
      (v_item ->> 'taxable_amt')::numeric + (v_item ->> 'tax_amt')::numeric,
      coalesce((v_item ->> 'sort_order')::int, 0)
    ) returning id into v_invoice_item_id;

    if nullif(v_item ->> 'product_id', '') is not null then
      select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and shop_id = p_shop_id
      for update;
      if not found then
        raise exception 'product does not belong to this shop' using errcode = '42501';
      end if;
      if v_product.stock_qty is not null then
        if v_product.stock_qty - (v_item ->> 'quantity')::numeric < 0 then
          raise exception 'insufficient_stock: %', v_product.name using errcode = '23514';
        end if;
        update public.products
        set stock_qty = stock_qty - (v_item ->> 'quantity')::numeric
        where id = v_product.id;
        insert into public.inventory_logs (
          shop_id, product_id, type, quantity_change, previous_stock,
          new_stock, reference_id, reference_number, notes, created_by
        ) values (
          p_shop_id, v_product.id, 'SALE',
          -(v_item ->> 'quantity')::numeric, v_product.stock_qty,
          v_product.stock_qty - (v_item ->> 'quantity')::numeric,
          v_invoice_id, v_invoice_number,
          'Sold via Bill ' || v_invoice_number, v_actor
        );
        if v_product.track_expiry then
          v_remaining := (v_item ->> 'quantity')::numeric;
          v_alloc_count := 0;
          v_single_batch_id := null;
          for v_batch in
            select * from public.product_batches
            where shop_id = p_shop_id and product_id = v_product.id
              and qty > 0
              and (expiry_date is null or expiry_date >= current_date)
            order by expiry_date asc nulls last, created_at asc
            for update
          loop
            exit when v_remaining <= 0;
            v_take := least(v_batch.qty, v_remaining);
            if v_take > 0 then
              update public.product_batches
              set qty = qty - v_take where id = v_batch.id;
              insert into public.invoice_batch_allocations (
                shop_id, invoice_id, invoice_item_id, batch_id, qty
              ) values (
                p_shop_id, v_invoice_id, v_invoice_item_id, v_batch.id, v_take
              );
              insert into public.inventory_logs (
                shop_id, product_id, batch_id, type, quantity_change,
                previous_stock, new_stock, reference_id, reference_number,
                notes, created_by
              ) values (
                p_shop_id, v_product.id, v_batch.id, 'SALE', -v_take,
                v_batch.qty, v_batch.qty - v_take,
                v_invoice_id, v_invoice_number,
                'FEFO batch ' || v_batch.batch_no, v_actor
              );
              v_alloc_count := v_alloc_count + 1;
              v_single_batch_id := v_batch.id;
              v_remaining := v_remaining - v_take;
            end if;
          end loop;
          if v_alloc_count = 1 and v_remaining = 0 then
            update public.invoice_items
            set batch_id = v_single_batch_id where id = v_invoice_item_id;
          end if;
        end if;
      end if;
    end if;
  end loop;

  if v_amount_paid > 0 then
    insert into public.payments (
      shop_id, invoice_id, customer_id, amount, mode, received_by, source, kind
    ) values (
      p_shop_id, v_invoice_id, v_customer_id, v_amount_paid,
      coalesce(nullif(p_payload ->> 'payment_mode', ''), 'cash'),
      v_actor, 'invoice_create', 'receipt'
    );
  end if;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id)
  values (p_shop_id, 'invoice_created', 'invoice', v_invoice_id,
          'Bill ' || v_invoice_number || ' created', v_actor);

  return v_invoice_id;
end;
$$;

grant execute on function public.create_invoice_tx(uuid, uuid, jsonb) to authenticated;
revoke execute on function public.create_invoice_tx(uuid, uuid, jsonb) from anon, public;
grant execute on function public.create_invoice_tx(uuid, uuid, jsonb) to service_role;

-- -------------------------------------------------- convert_quotation_tx
-- Full body from 0006, with the same FEFO block as create_invoice_tx
-- in its item loop, so converted bills track batches identically.
create or replace function public.convert_quotation_tx(
  p_quotation_id uuid, p_actor uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_q record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_item record;
  v_product record;
  v_invoice_item_id uuid;
  v_remaining numeric;
  v_batch record;
  v_take numeric;
  v_alloc_count int;
  v_single_batch_id uuid;
begin
  select * into v_q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_q.shop_id, v_actor, array['owner', 'manager', 'cashier']);
  if v_q.status not in ('draft', 'sent', 'accepted') then
    raise exception 'quotation cannot be converted from status %', v_q.status
      using errcode = '23514';
  end if;

  update public.shops
  set invoice_counter = invoice_counter + 1
  where id = v_q.shop_id
  returning invoice_prefix || '-' || invoice_counter into v_invoice_number;

  insert into public.invoices (
    shop_id, customer_id, quotation_id, invoice_number, customer_name,
    customer_phone, customer_address, customer_gstin, customer_state_code,
    invoice_date, subtotal, discount_pct, discount_amt, taxable_amt,
    cgst_amt, sgst_amt, igst_amt, round_off_amt, place_of_supply_state_code,
    is_interstate, total, amount_paid, balance_due, payment_status, source
  ) values (
    v_q.shop_id, v_q.customer_id, v_q.id, v_invoice_number, v_q.customer_name,
    v_q.customer_phone, v_q.customer_address, v_q.customer_gstin,
    v_q.customer_state_code, current_date, v_q.subtotal, v_q.discount_pct,
    v_q.discount_amt, v_q.taxable_amt, v_q.cgst_amt, v_q.sgst_amt,
    v_q.igst_amt, v_q.round_off_amt, v_q.place_of_supply_state_code,
    v_q.is_interstate, v_q.total, 0, v_q.total, 'unpaid', 'conversion'
  ) returning id into v_invoice_id;

  for v_item in
    select * from public.quotation_items
    where quotation_id = v_q.id order by sort_order
  loop
    insert into public.invoice_items (
      invoice_id, product_id, name, hsn_code, unit, quantity, unit_price,
      making_charge, tax_rate, discount_amt, taxable_amt, tax_amt, total, sort_order
    ) values (
      v_invoice_id, v_item.product_id, v_item.name, v_item.hsn_code, v_item.unit,
      v_item.quantity, v_item.unit_price, v_item.making_charge, v_item.tax_rate,
      v_item.discount_amt, v_item.taxable_amt, v_item.tax_amt, v_item.total,
      v_item.sort_order
    ) returning id into v_invoice_item_id;

    if v_item.product_id is not null then
      select * into v_product from public.products
      where id = v_item.product_id and shop_id = v_q.shop_id for update;
      if found and v_product.stock_qty is not null then
        if v_product.stock_qty - v_item.quantity < 0 then
          raise exception 'insufficient_stock: %', v_product.name using errcode = '23514';
        end if;
        update public.products
        set stock_qty = stock_qty - v_item.quantity where id = v_product.id;
        insert into public.inventory_logs (
          shop_id, product_id, type, quantity_change, previous_stock,
          new_stock, reference_id, reference_number, notes, created_by
        ) values (
          v_q.shop_id, v_product.id, 'SALE', -v_item.quantity,
          v_product.stock_qty, v_product.stock_qty - v_item.quantity,
          v_invoice_id, v_invoice_number,
          'Sold via Bill ' || v_invoice_number, v_actor
        );
        if v_product.track_expiry then
          v_remaining := v_item.quantity;
          v_alloc_count := 0;
          v_single_batch_id := null;
          for v_batch in
            select * from public.product_batches
            where shop_id = v_q.shop_id and product_id = v_product.id
              and qty > 0
              and (expiry_date is null or expiry_date >= current_date)
            order by expiry_date asc nulls last, created_at asc
            for update
          loop
            exit when v_remaining <= 0;
            v_take := least(v_batch.qty, v_remaining);
            if v_take > 0 then
              update public.product_batches
              set qty = qty - v_take where id = v_batch.id;
              insert into public.invoice_batch_allocations (
                shop_id, invoice_id, invoice_item_id, batch_id, qty
              ) values (
                v_q.shop_id, v_invoice_id, v_invoice_item_id, v_batch.id, v_take
              );
              insert into public.inventory_logs (
                shop_id, product_id, batch_id, type, quantity_change,
                previous_stock, new_stock, reference_id, reference_number,
                notes, created_by
              ) values (
                v_q.shop_id, v_product.id, v_batch.id, 'SALE', -v_take,
                v_batch.qty, v_batch.qty - v_take,
                v_invoice_id, v_invoice_number,
                'FEFO batch ' || v_batch.batch_no, v_actor
              );
              v_alloc_count := v_alloc_count + 1;
              v_single_batch_id := v_batch.id;
              v_remaining := v_remaining - v_take;
            end if;
          end loop;
          if v_alloc_count = 1 and v_remaining = 0 then
            update public.invoice_items
            set batch_id = v_single_batch_id where id = v_invoice_item_id;
          end if;
        end if;
      end if;
    end if;
  end loop;

  update public.quotations
  set status = 'converted', converted_invoice_id = v_invoice_id
  where id = v_q.id;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id)
  values (v_q.shop_id, 'quotation_converted', 'quotation', v_q.id,
          'Quotation ' || v_q.quotation_number || ' converted to Bill ' || v_invoice_number, v_actor);

  return v_invoice_id;
end;
$$;

grant execute on function public.convert_quotation_tx(uuid, uuid) to authenticated;
revoke execute on function public.convert_quotation_tx(uuid, uuid) from anon, public;
grant execute on function public.convert_quotation_tx(uuid, uuid) to service_role;

-- ------------------------------------------------------ cancel_invoice_tx
-- Full body from 0006, plus the FEFO reversal loop after the item
-- loop: each allocation row returns its qty to its batch and writes
-- a batch level REVERSAL log row. The has_payments block is unchanged.
create or replace function public.cancel_invoice_tx(
  p_invoice_id uuid, p_reason text, p_actor uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_invoice record;
  v_item record;
  v_product record;
  v_alloc record;
  v_batch_rec record;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_invoice.shop_id, v_actor, array['owner', 'manager']);
  if v_invoice.status <> 'active' then
    raise exception 'invoice is not active' using errcode = '23514';
  end if;
  -- Phase 0 rule (blueprint B.6): a bill with receipts is never silently
  -- cancelled. The caller must first record a refund payment (kind =
  -- 'refund') through the refund flow, which is what unblocks this check
  -- in the UI path; until that flow ships this raise is the behaviour.
  if v_invoice.amount_paid > 0 then
    raise exception 'has_payments' using errcode = '23514';
  end if;

  for v_item in
    select * from public.invoice_items where invoice_id = p_invoice_id
  loop
    if v_item.product_id is not null then
      select * into v_product from public.products
      where id = v_item.product_id and shop_id = v_invoice.shop_id for update;
      if found and v_product.stock_qty is not null then
        update public.products
        set stock_qty = stock_qty + v_item.quantity where id = v_product.id;
        insert into public.inventory_logs (
          shop_id, product_id, type, quantity_change, previous_stock,
          new_stock, reference_id, reference_number, notes, created_by
        ) values (
          v_invoice.shop_id, v_product.id, 'REVERSAL', v_item.quantity,
          v_product.stock_qty, v_product.stock_qty + v_item.quantity,
          p_invoice_id, v_invoice.invoice_number,
          'Cancel reversal for Bill ' || v_invoice.invoice_number, v_actor
        );
      end if;
    end if;
  end loop;

  -- FEFO reversal: give every allocated unit back to the exact batch it
  -- came from, with a batch level REVERSAL log row per allocation.
  for v_alloc in
    select * from public.invoice_batch_allocations
    where invoice_id = p_invoice_id
    order by created_at asc
  loop
    select * into v_batch_rec from public.product_batches
    where id = v_alloc.batch_id for update;
    if found then
      update public.product_batches
      set qty = qty + v_alloc.qty where id = v_batch_rec.id;
      insert into public.inventory_logs (
        shop_id, product_id, batch_id, type, quantity_change, previous_stock,
        new_stock, reference_id, reference_number, notes, created_by
      ) values (
        v_invoice.shop_id, v_batch_rec.product_id, v_batch_rec.id, 'REVERSAL',
        v_alloc.qty, v_batch_rec.qty, v_batch_rec.qty + v_alloc.qty,
        p_invoice_id, v_invoice.invoice_number,
        'FEFO reversal batch ' || v_batch_rec.batch_no, v_actor
      );
    end if;
  end loop;

  update public.invoices
  set status = 'cancelled', cancelled_at = now(),
      cancelled_by = v_actor, cancel_reason = p_reason
  where id = p_invoice_id;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id)
  values (v_invoice.shop_id, 'invoice_cancelled', 'invoice', p_invoice_id,
          'Bill ' || v_invoice.invoice_number || ' cancelled: ' || coalesce(p_reason, ''), v_actor);
end;
$$;

grant execute on function public.cancel_invoice_tx(uuid, text, uuid) to authenticated;
revoke execute on function public.cancel_invoice_tx(uuid, text, uuid) from anon, public;
grant execute on function public.cancel_invoice_tx(uuid, text, uuid) to service_role;
