-- 0024: Customers always saved, catalog auto-add (fix round, Stage 3).
--
-- Two gaps in the billing RPCs, both found in live testing:
--
-- 1. create_invoice_tx only find-or-created a customer when a phone
--    number was present, so a walk-in typed by name alone was never
--    saved. create_quotation_tx never saved a new customer at all.
--    Both functions now find-or-create by name when no phone is
--    given (exact match, case-insensitive, trimmed, within the
--    shop). The customer row is written at document creation, so it
--    persists whatever the document's later status becomes: paid,
--    pending or cancelled. Cancellation behaviour is untouched (it
--    never deleted customers).
--
-- 2. Bill and quotation lines without a product_id were never
--    written to the catalog, so a new item typed at billing had to
--    be typed again tomorrow. Both functions now find-or-create the
--    product by normalized name (lower/trim, active products only)
--    and link the line to it. An auto-created product carries the
--    line's price, HSN and tax rate, and stock_qty NULL (untracked),
--    so it can never trip the stock gate. Name-matched lines do NOT
--    move stock: stock deduction, the SALE ledger and FEFO batch
--    allocation still happen only when the caller explicitly sent a
--    product_id, exactly as before.
--
-- Bodies are the current ones (invoice from 0016 with FEFO,
-- quotation from 0013) with only these blocks changed. Money
-- invariants are unchanged: integer paise at the app layer, tax on
-- the discounted value, totals re-validated before any write.

-- ------------------------------------------------------ create_invoice_tx
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
  v_item_product_id uuid;
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

  -- Customer: validate ownership, or find-or-create in this shop.
  -- By phone when a phone is present (the unique (shop_id, phone)
  -- behaviour from 0006); otherwise by name, so a customer typed at
  -- billing is saved even without a phone.
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
  elsif coalesce(trim(p_payload ->> 'customer_name'), '') <> '' then
    select id into v_customer_id from public.customers
    where shop_id = p_shop_id
      and lower(trim(name)) = lower(trim(p_payload ->> 'customer_name'))
    order by created_at asc
    limit 1;
    if v_customer_id is null then
      insert into public.customers (shop_id, name, address, gstin, state_code)
      values (
        p_shop_id,
        trim(p_payload ->> 'customer_name'),
        nullif(p_payload ->> 'customer_address', ''),
        nullif(p_payload ->> 'customer_gstin', ''),
        nullif(p_payload ->> 'customer_state_code', '')
      )
      returning id into v_customer_id;
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
    -- Catalog auto-add: a line with no explicit product is matched to
    -- the shop's catalog by name, or created untracked, and linked.
    -- Stock below still moves only for an explicitly sent product_id.
    v_item_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    if v_item_product_id is null
       and coalesce(trim(v_item ->> 'name'), '') <> '' then
      select id into v_item_product_id from public.products
      where shop_id = p_shop_id and is_active
        and lower(trim(name)) = lower(trim(v_item ->> 'name'))
      order by created_at asc
      limit 1;
      if v_item_product_id is null then
        insert into public.products (
          shop_id, name, hsn_code, unit, price, tax_rate, stock_qty, is_active
        ) values (
          p_shop_id, trim(v_item ->> 'name'),
          nullif(v_item ->> 'hsn_code', ''),
          coalesce(nullif(v_item ->> 'unit', ''), 'piece'),
          coalesce((v_item ->> 'unit_price')::numeric, 0),
          coalesce((v_item ->> 'tax_rate')::numeric, 0),
          null, true
        ) returning id into v_item_product_id;
      end if;
    end if;

    insert into public.invoice_items (
      invoice_id, product_id, name, hsn_code, unit, quantity, unit_price,
      making_charge, tax_rate, discount_amt, taxable_amt, tax_amt, total, sort_order
    ) values (
      v_invoice_id,
      v_item_product_id,
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

-- ---------------------------------------------------- create_quotation_tx
-- Body from 0013, with the same customer find-or-create and catalog
-- auto-add as create_invoice_tx above. Quotations still never move
-- stock and never write payments.
create or replace function public.create_quotation_tx(
  p_shop_id uuid, p_actor uuid, p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_totals jsonb := p_payload -> 'totals';
  v_customer_id uuid := nullif(p_payload ->> 'customer_id', '')::uuid;
  v_quotation_id uuid;
  v_quotation_number text;
  v_item jsonb;
  v_item_product_id uuid;
  v_items_taxable numeric := 0;
  v_items_tax numeric := 0;
begin
  perform app.assert_shop_role(p_shop_id, v_actor, array['owner', 'manager', 'cashier']);

  select coalesce(sum((i ->> 'taxable_amt')::numeric), 0),
         coalesce(sum((i ->> 'tax_amt')::numeric), 0)
  into v_items_taxable, v_items_tax
  from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as i;

  if abs(v_items_taxable - (v_totals ->> 'taxable_amt')::numeric) > 0.01
     or abs(v_items_tax - ((v_totals ->> 'cgst_amt')::numeric
                         + (v_totals ->> 'sgst_amt')::numeric
                         + (v_totals ->> 'igst_amt')::numeric)) > 0.01
     or abs((v_totals ->> 'total')::numeric - ((v_totals ->> 'taxable_amt')::numeric
                     + (v_totals ->> 'cgst_amt')::numeric
                     + (v_totals ->> 'sgst_amt')::numeric
                     + (v_totals ->> 'igst_amt')::numeric
                     + (v_totals ->> 'round_off_amt')::numeric)) > 0.01 then
    raise exception 'totals do not reconcile with items' using errcode = '23514';
  end if;

  -- Customer: validate ownership, or find-or-create in this shop,
  -- by phone when present, otherwise by name (same as invoices).
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
  elsif coalesce(trim(p_payload ->> 'customer_name'), '') <> '' then
    select id into v_customer_id from public.customers
    where shop_id = p_shop_id
      and lower(trim(name)) = lower(trim(p_payload ->> 'customer_name'))
    order by created_at asc
    limit 1;
    if v_customer_id is null then
      insert into public.customers (shop_id, name, address, gstin, state_code)
      values (
        p_shop_id,
        trim(p_payload ->> 'customer_name'),
        nullif(p_payload ->> 'customer_address', ''),
        nullif(p_payload ->> 'customer_gstin', ''),
        nullif(p_payload ->> 'customer_state_code', '')
      )
      returning id into v_customer_id;
    end if;
  end if;

  update public.shops
  set quotation_counter = quotation_counter + 1
  where id = p_shop_id
  returning quotation_prefix || '-' || quotation_counter into v_quotation_number;

  insert into public.quotations (
    shop_id, customer_id, quotation_number, customer_name, customer_phone,
    customer_address, customer_gstin, customer_state_code, subtotal,
    discount_pct, discount_amt, taxable_amt, cgst_amt, sgst_amt, igst_amt,
    tax_amt, round_off_amt, place_of_supply_state_code, is_interstate,
    total, status, valid_until, notes
  ) values (
    p_shop_id, v_customer_id, v_quotation_number, p_payload ->> 'customer_name',
    nullif(p_payload ->> 'customer_phone', ''),
    nullif(p_payload ->> 'customer_address', ''),
    nullif(p_payload ->> 'customer_gstin', ''),
    nullif(p_payload ->> 'customer_state_code', ''),
    (v_totals ->> 'subtotal')::numeric,
    coalesce((p_payload ->> 'discount_pct')::numeric, 0),
    (v_totals ->> 'discount_amt')::numeric,
    (v_totals ->> 'taxable_amt')::numeric,
    (v_totals ->> 'cgst_amt')::numeric,
    (v_totals ->> 'sgst_amt')::numeric,
    (v_totals ->> 'igst_amt')::numeric,
    (v_totals ->> 'cgst_amt')::numeric + (v_totals ->> 'sgst_amt')::numeric
      + (v_totals ->> 'igst_amt')::numeric,
    (v_totals ->> 'round_off_amt')::numeric,
    nullif(p_payload ->> 'place_of_supply_state_code', ''),
    coalesce((p_payload ->> 'is_interstate')::boolean, false),
    (v_totals ->> 'total')::numeric, 'draft',
    nullif(p_payload ->> 'valid_until', '')::date,
    nullif(p_payload ->> 'notes', '')
  ) returning id into v_quotation_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    -- Catalog auto-add, same rule as invoices: match by name or
    -- create untracked, then link the line.
    v_item_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    if v_item_product_id is null
       and coalesce(trim(v_item ->> 'name'), '') <> '' then
      select id into v_item_product_id from public.products
      where shop_id = p_shop_id and is_active
        and lower(trim(name)) = lower(trim(v_item ->> 'name'))
      order by created_at asc
      limit 1;
      if v_item_product_id is null then
        insert into public.products (
          shop_id, name, hsn_code, unit, price, tax_rate, stock_qty, is_active
        ) values (
          p_shop_id, trim(v_item ->> 'name'),
          nullif(v_item ->> 'hsn_code', ''),
          coalesce(nullif(v_item ->> 'unit', ''), 'piece'),
          coalesce((v_item ->> 'unit_price')::numeric, 0),
          coalesce((v_item ->> 'tax_rate')::numeric, 0),
          null, true
        ) returning id into v_item_product_id;
      end if;
    end if;

    insert into public.quotation_items (
      quotation_id, product_id, name, hsn_code, unit, quantity, unit_price,
      making_charge, tax_rate, discount_amt, taxable_amt, tax_amt, total,
      sort_order
    ) values (
      v_quotation_id,
      v_item_product_id,
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
    );
  end loop;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id)
  values (p_shop_id, 'quotation_created', 'quotation', v_quotation_id,
          'Quotation ' || v_quotation_number || ' created', v_actor);

  return v_quotation_id;
end;
$$;

grant execute on function public.create_quotation_tx(uuid, uuid, jsonb) to authenticated;
revoke execute on function public.create_quotation_tx(uuid, uuid, jsonb) from anon, public;
grant execute on function public.create_quotation_tx(uuid, uuid, jsonb) to service_role;
