-- 0013: RPC-only writes for billing tables (blueprint B.4 note, C3, C7,
-- C8). Stage 2 moves the invoices and quotations routers onto the RPCs
-- from 0006, so the direct PostgREST write paths those routers used to
-- take are closed here:
--
--   * invoices, invoice_items: inserts now happen only inside
--     create_invoice_tx and convert_quotation_tx (security definer).
--     Updates and deletes were already policy-less; the grants are
--     revoked too so the closure does not depend on RLS alone.
--   * payments: inserts only inside create_invoice_tx,
--     record_payment_tx and bulk_mark_paid_tx.
--   * inventory_logs: inserts only inside the invoice, conversion,
--     cancel and stock-adjust RPCs.
--   * quotations, quotation_items: inserts and updates only inside the
--     new create_quotation_tx (below) and convert_quotation_tx.
--
-- Reads stay exactly as they were in 0005 (member-scoped SELECT), and
-- customers, products, shops, staff_members and activity_log keep their
-- 0005 write policies because their routers still write through
-- PostgREST in this stage. The security definer RPCs run as the
-- function owner and are unaffected by these revokes; each RPC still
-- re-checks shop membership itself via app.assert_shop_role.

-- ------------------------------------------------------- create_quotation_tx
-- Mirror of create_invoice_tx for quotations (blueprint C8): totals
-- arrive computed by src/lib/money.ts and are re-validated before any
-- write. Quotations never move stock and never write payments.
-- p_payload shape:
-- {
--   customer_id, customer_name, customer_phone, customer_address,
--   customer_gstin, customer_state_code, valid_until, notes,
--   discount_pct, is_interstate, place_of_supply_state_code,
--   totals: { subtotal, discount_amt, taxable_amt, cgst_amt, sgst_amt,
--             igst_amt, round_off_amt, total },
--   items: [{ product_id, name, hsn_code, unit, quantity, unit_price,
--             making_charge, tax_rate, discount_amt, taxable_amt,
--             tax_amt, total }]
-- }
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

  if v_customer_id is not null and not exists (
    select 1 from public.customers
    where id = v_customer_id and shop_id = p_shop_id
  ) then
    raise exception 'customer does not belong to this shop' using errcode = '42501';
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
    insert into public.quotation_items (
      quotation_id, product_id, name, hsn_code, unit, quantity, unit_price,
      making_charge, tax_rate, discount_amt, taxable_amt, tax_amt, total,
      sort_order
    ) values (
      v_quotation_id,
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

-- ------------------------------------------------------------ tightening
drop policy if exists invoices_insert_member on public.invoices;
revoke insert, update, delete on public.invoices from authenticated;

drop policy if exists invoice_items_insert_member on public.invoice_items;
revoke insert, update, delete on public.invoice_items from authenticated;

drop policy if exists payments_insert_member on public.payments;
revoke insert, update, delete on public.payments from authenticated;

drop policy if exists inventory_logs_insert_member on public.inventory_logs;
revoke insert, update, delete on public.inventory_logs from authenticated;

drop policy if exists quotations_insert_member on public.quotations;
drop policy if exists quotations_update_member on public.quotations;
revoke insert, update, delete on public.quotations from authenticated;

drop policy if exists quotation_items_insert_member on public.quotation_items;
revoke insert, update, delete on public.quotation_items from authenticated;
