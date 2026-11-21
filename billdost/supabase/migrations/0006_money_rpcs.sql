-- 0006: Money RPCs (blueprint B.6). All functions are security definer
-- with a pinned search_path and re-check shop membership themselves,
-- because definer functions bypass RLS. Money totals arrive computed by
-- src/lib/money.ts and are re-validated for arithmetic consistency
-- before anything is written.

-- Refund rows (blueprint B.6, cancel_invoice_tx note).
alter table public.payments
  add column if not exists kind text not null default 'receipt';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_kind_check'
  ) then
    alter table public.payments
      add constraint payments_kind_check check (kind in ('receipt', 'refund'));
  end if;
end;
$$;

-- Internal guard: returns the caller's role in a shop or raises 42501.
create or replace function app.assert_shop_role(
  p_shop_id uuid, p_actor uuid, p_roles text[]
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  select 'owner' into v_role
  from public.shops where id = p_shop_id and owner_id = p_actor;
  if v_role is null then
    select role into v_role
    from public.staff_members
    where shop_id = p_shop_id and user_id = p_actor and status = 'active'
    limit 1;
  end if;
  if v_role is null or not (v_role = any (p_roles)) then
    raise exception 'not a shop member with a required role' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

-- ------------------------------------------------- next_document_number
create or replace function public.next_document_number(p_shop_id uuid, p_kind text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), null);
  v_number text;
begin
  if v_actor is not null then
    perform app.assert_shop_role(p_shop_id, v_actor, array['owner', 'manager', 'cashier']);
  end if;
  if p_kind = 'invoice' then
    update public.shops
    set invoice_counter = invoice_counter + 1
    where id = p_shop_id
    returning invoice_prefix || '-' || invoice_counter into v_number;
  elsif p_kind = 'quotation' then
    update public.shops
    set quotation_counter = quotation_counter + 1
    where id = p_shop_id
    returning quotation_prefix || '-' || quotation_counter into v_number;
  else
    raise exception 'unknown document kind: %', p_kind using errcode = '22023';
  end if;
  if v_number is null then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  return v_number;
end;
$$;

grant execute on function public.next_document_number(uuid, text) to authenticated;
revoke execute on function public.next_document_number(uuid, text) from anon, public;
grant execute on function public.next_document_number(uuid, text) to service_role;

-- ------------------------------------------------------ create_invoice_tx
-- p_payload shape (totals computed by src/lib/money.ts):
-- {
--   customer_id, customer_name, customer_phone, customer_address,
--   customer_gstin, customer_state_code, invoice_date, due_date,
--   discount_pct, amount_paid, payment_mode, include_upi_qr, notes,
--   source, is_interstate, place_of_supply_state_code,
--   totals: { subtotal, discount_amt, taxable_amt, cgst_amt, sgst_amt,
--             igst_amt, round_off_amt, total },
--   items: [{ product_id, name, hsn_code, unit, quantity, unit_price,
--             making_charge, tax_rate, discount_amt, taxable_amt,
--             tax_amt, total }]
-- }
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
    );

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

-- ----------------------------------------------------- record_payment_tx
create or replace function public.record_payment_tx(
  p_invoice_id uuid, p_amount numeric, p_mode text, p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_invoice record;
  v_new_paid numeric;
  v_new_due numeric;
  v_status text;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_invoice.shop_id, v_actor, array['owner', 'manager', 'cashier']);
  if v_invoice.status <> 'active' then
    raise exception 'invoice is not active' using errcode = '23514';
  end if;
  if p_amount <= 0 or p_amount > v_invoice.balance_due then
    raise exception 'payment amount out of range' using errcode = '23514';
  end if;

  v_new_paid := v_invoice.amount_paid + p_amount;
  v_new_due := v_invoice.total - v_new_paid;
  v_status := case when v_new_due <= 0 then 'paid' else 'partial' end;

  update public.invoices
  set amount_paid = v_new_paid,
      balance_due = v_new_due,
      payment_status = v_status,
      payment_mode = p_mode,
      paid_at = case when v_status = 'paid' then now() else paid_at end
  where id = p_invoice_id;

  insert into public.payments (shop_id, invoice_id, customer_id, amount, mode, received_by, source, kind)
  values (v_invoice.shop_id, p_invoice_id, v_invoice.customer_id, p_amount, p_mode, v_actor, 'manual', 'receipt');

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id)
  values (v_invoice.shop_id, 'payment_received', 'invoice', p_invoice_id,
          'Payment received for Bill ' || v_invoice.invoice_number, v_actor);

  return jsonb_build_object(
    'amount_paid', v_new_paid,
    'balance_due', v_new_due,
    'payment_status', v_status
  );
end;
$$;

grant execute on function public.record_payment_tx(uuid, numeric, text, uuid) to authenticated;
revoke execute on function public.record_payment_tx(uuid, numeric, text, uuid) from anon, public;
grant execute on function public.record_payment_tx(uuid, numeric, text, uuid) to service_role;

-- ----------------------------------------------------- bulk_mark_paid_tx
create or replace function public.bulk_mark_paid_tx(
  p_invoice_ids uuid[], p_actor uuid
) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_invoice record;
  v_count int := 0;
  v_id uuid;
begin
  foreach v_id in array coalesce(p_invoice_ids, array[]::uuid[])
  loop
    select * into v_invoice from public.invoices where id = v_id for update;
    if not found then
      continue;
    end if;
    perform app.assert_shop_role(v_invoice.shop_id, v_actor, array['owner', 'manager']);
    if v_invoice.status <> 'active' or v_invoice.balance_due <= 0 then
      continue;
    end if;
    update public.invoices
    set amount_paid = total, balance_due = 0, payment_status = 'paid', paid_at = now()
    where id = v_id;
    insert into public.payments (shop_id, invoice_id, customer_id, amount, mode, received_by, source, kind)
    values (v_invoice.shop_id, v_id, v_invoice.customer_id, v_invoice.balance_due, 'cash', v_actor, 'bulk', 'receipt');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.bulk_mark_paid_tx(uuid[], uuid) to authenticated;
revoke execute on function public.bulk_mark_paid_tx(uuid[], uuid) from anon, public;
grant execute on function public.bulk_mark_paid_tx(uuid[], uuid) to service_role;

-- -------------------------------------------------- convert_quotation_tx
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
    );

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

-- -------------------------------------------------------- adjust_stock_tx
create or replace function public.adjust_stock_tx(
  p_product_id uuid, p_new_qty numeric, p_type text, p_note text, p_actor uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_product record;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  perform app.assert_shop_role(v_product.shop_id, v_actor, array['owner', 'manager']);
  if p_type not in ('STOCK_IN', 'STOCK_OUT', 'AUDIT') then
    raise exception 'invalid adjustment type: %', p_type using errcode = '22023';
  end if;
  if p_new_qty < 0 then
    raise exception 'stock cannot be negative' using errcode = '23514';
  end if;
  if v_product.stock_qty is null then
    raise exception 'stock is not tracked for this product' using errcode = '23514';
  end if;

  update public.products set stock_qty = p_new_qty where id = p_product_id;

  insert into public.inventory_logs (
    shop_id, product_id, type, quantity_change, previous_stock, new_stock,
    notes, created_by
  ) values (
    v_product.shop_id, p_product_id, p_type,
    p_new_qty - v_product.stock_qty, v_product.stock_qty, p_new_qty,
    p_note, v_actor
  );
end;
$$;

grant execute on function public.adjust_stock_tx(uuid, numeric, text, text, uuid) to authenticated;
revoke execute on function public.adjust_stock_tx(uuid, numeric, text, text, uuid) from anon, public;
grant execute on function public.adjust_stock_tx(uuid, numeric, text, text, uuid) to service_role;

-- ------------------------------------------------------ accept_staff_invite
-- The invited to active flip (blueprint B.9). Runs as the signed-in user.
create or replace function public.accept_staff_invite()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_shop_id uuid;
  v_row record;
begin
  if v_uid is null then
    return null;
  end if;
  for v_row in
    select * from public.staff_members
    where status = 'invited'
      and (user_id = v_uid or (v_email <> '' and lower(email) = v_email))
  loop
    update public.staff_members
    set user_id = v_uid, status = 'active', last_seen_at = now()
    where id = v_row.id;
    if v_shop_id is null then
      v_shop_id := v_row.shop_id;
    end if;
  end loop;
  return v_shop_id;
end;
$$;

grant execute on function public.accept_staff_invite() to authenticated;
revoke execute on function public.accept_staff_invite() from anon, public;
grant execute on function public.accept_staff_invite() to service_role;
