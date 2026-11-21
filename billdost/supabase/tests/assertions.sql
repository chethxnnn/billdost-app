-- assertions.sql: PG harness assertions for migrations 0001 to 0016.
-- Run by run-pg-harness.mjs after stubs, all migrations and seed.sql.
-- Each group starts with a marker comment of the form
--   -- ASSERT: group_name
-- and is a DO block (plus, for the identity groups, set_config calls)
-- that raises an exception on failure. The runner executes each group
-- separately and counts a group as passed when it runs clean.
--
-- Demo fixtures from seed.sql: shop 22222222-2222-2222-2222-222222222222,
-- owner 11111111-1111-1111-1111-111111111111, invoice counter at 1000,
-- quotation counter at 100. All invoice payloads use tax_rate 0 items
-- so the reconciliation arithmetic is trivial: taxable equals
-- quantity times unit_price, tax is 0, total equals taxable.

create temp table if not exists harness_state (
  k text primary key,
  v uuid,
  n numeric
);

create or replace function pg_temp.make_product(
  p_name text, p_stock numeric, p_track boolean, p_price numeric
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.products (shop_id, name, unit, price, tax_rate, stock_qty, track_expiry)
  values ('22222222-2222-2222-2222-222222222222', p_name, 'piece', p_price, 0, p_stock, p_track)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.make_batch(
  p_product_id uuid, p_batch_no text, p_qty numeric, p_expiry date
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.product_batches (shop_id, product_id, batch_no, expiry_date, qty)
  values ('22222222-2222-2222-2222-222222222222', p_product_id, p_batch_no, p_expiry, p_qty)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.payload(
  p_product_id uuid, p_qty numeric, p_price numeric, p_amount_paid numeric
) returns jsonb
language sql
as $$
  select jsonb_build_object(
    'customer_name', 'Test Customer',
    'amount_paid', p_amount_paid,
    'payment_mode', 'cash',
    'totals', jsonb_build_object(
      'subtotal', p_qty * p_price,
      'discount_amt', 0,
      'taxable_amt', p_qty * p_price,
      'cgst_amt', 0,
      'sgst_amt', 0,
      'igst_amt', 0,
      'round_off_amt', 0,
      'total', p_qty * p_price
    ),
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', p_product_id,
      'name', 'Test Item',
      'unit', 'piece',
      'quantity', p_qty,
      'unit_price', p_price,
      'tax_rate', 0,
      'discount_amt', 0,
      'taxable_amt', p_qty * p_price,
      'tax_amt', 0,
      'total', p_qty * p_price
    ))
  );
$$;

-- ASSERT: create_invoice_happy_path
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_inv uuid;
  v_num text;
  v_total numeric;
  v_stock numeric;
  v_logs int;
begin
  v_pid := pg_temp.make_product('Harness Rice', 40, false, 100);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 2, 100, 0));
  select invoice_number, total into v_num, v_total from public.invoices where id = v_inv;
  if v_num <> 'INV-1001' then
    raise exception 'ASSERT FAIL happy_path: expected INV-1001, got %', v_num;
  end if;
  if v_total <> 200 then
    raise exception 'ASSERT FAIL happy_path: expected total 200, got %', v_total;
  end if;
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 38 then
    raise exception 'ASSERT FAIL happy_path: expected stock 38, got %', v_stock;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where reference_id = v_inv and type = 'SALE' and batch_id is null;
  if v_logs <> 1 then
    raise exception 'ASSERT FAIL happy_path: expected 1 SALE log, got %', v_logs;
  end if;
  insert into harness_state (k, v) values ('g1_invoice', v_inv), ('g1_product', v_pid)
  on conflict (k) do update set v = excluded.v;
end;
$$;

-- ASSERT: forged_totals_rejected
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_payload jsonb;
  v_accepted boolean := false;
  v_code text;
begin
  v_pid := pg_temp.make_product('Harness Forged', 40, false, 100);
  v_payload := pg_temp.payload(v_pid, 1, 100, 0);
  v_payload := jsonb_set(v_payload, '{totals,taxable_amt}', '999'::jsonb);
  v_payload := jsonb_set(v_payload, '{totals,total}', '999'::jsonb);
  begin
    perform public.create_invoice_tx(v_shop, v_owner, v_payload);
    v_accepted := true;
  exception when others then
    v_code := sqlstate;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL forged_totals: forged totals were accepted';
  end if;
  if v_code <> '23514' then
    raise exception 'ASSERT FAIL forged_totals: expected errcode 23514, got %', v_code;
  end if;
end;
$$;

-- ASSERT: insufficient_stock_rejected
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_accepted boolean := false;
  v_code text;
  v_msg text;
begin
  v_pid := pg_temp.make_product('Harness Scarce', 5, false, 100);
  begin
    perform public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 10, 100, 0));
    v_accepted := true;
  exception when others then
    v_code := sqlstate;
    v_msg := sqlerrm;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL insufficient_stock: oversell was accepted';
  end if;
  if v_code <> '23514' or v_msg not like '%insufficient_stock%' then
    raise exception 'ASSERT FAIL insufficient_stock: expected 23514 insufficient_stock, got % %', v_code, v_msg;
  end if;
end;
$$;

-- ASSERT: record_payment_partial_then_full
do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_inv uuid;
  v_res jsonb;
  v_status text;
  v_paid numeric;
  v_due numeric;
begin
  select v into v_inv from harness_state where k = 'g1_invoice';
  if v_inv is null then
    raise exception 'ASSERT FAIL record_payment: g1 invoice missing';
  end if;
  v_res := public.record_payment_tx(v_inv, 50, 'cash', v_owner);
  if (v_res ->> 'payment_status') <> 'partial'
     or (v_res ->> 'amount_paid')::numeric <> 50
     or (v_res ->> 'balance_due')::numeric <> 150 then
    raise exception 'ASSERT FAIL record_payment: bad partial result %', v_res;
  end if;
  v_res := public.record_payment_tx(v_inv, 150, 'upi', v_owner);
  if (v_res ->> 'payment_status') <> 'paid'
     or (v_res ->> 'balance_due')::numeric <> 0 then
    raise exception 'ASSERT FAIL record_payment: bad full result %', v_res;
  end if;
  select payment_status, amount_paid, balance_due into v_status, v_paid, v_due
  from public.invoices where id = v_inv;
  if v_status <> 'paid' or v_paid <> 200 or v_due <> 0 then
    raise exception 'ASSERT FAIL record_payment: invoice row is % % %', v_status, v_paid, v_due;
  end if;
end;
$$;

-- ASSERT: overpayment_rejected
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_inv uuid;
  v_accepted boolean := false;
  v_code text;
begin
  v_pid := pg_temp.make_product('Harness Overpay', 10, false, 100);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 1, 100, 0));
  begin
    perform public.record_payment_tx(v_inv, 150, 'cash', v_owner);
    v_accepted := true;
  exception when others then
    v_code := sqlstate;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL overpayment: overpayment was accepted';
  end if;
  if v_code <> '23514' then
    raise exception 'ASSERT FAIL overpayment: expected errcode 23514, got %', v_code;
  end if;
end;
$$;

-- ASSERT: bulk_mark_paid
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_inv uuid;
  v_count int;
  v_status text;
  v_payments int;
begin
  v_pid := pg_temp.make_product('Harness Bulk', 10, false, 100);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 1, 100, 0));
  v_count := public.bulk_mark_paid_tx(array[v_inv], v_owner);
  if v_count <> 1 then
    raise exception 'ASSERT FAIL bulk_mark_paid: expected count 1, got %', v_count;
  end if;
  select payment_status into v_status from public.invoices where id = v_inv;
  if v_status <> 'paid' then
    raise exception 'ASSERT FAIL bulk_mark_paid: status is %', v_status;
  end if;
  select count(*) into v_payments from public.payments
  where invoice_id = v_inv and source = 'bulk';
  if v_payments <> 1 then
    raise exception 'ASSERT FAIL bulk_mark_paid: expected 1 bulk payment, got %', v_payments;
  end if;
end;
$$;

-- ASSERT: cancel_invoice_restores_stock
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_inv uuid;
  v_stock numeric;
  v_status text;
  v_logs int;
begin
  v_pid := pg_temp.make_product('Harness Cancel', 20, false, 100);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 3, 100, 0));
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 17 then
    raise exception 'ASSERT FAIL cancel: expected stock 17 after sale, got %', v_stock;
  end if;
  perform public.cancel_invoice_tx(v_inv, 'harness cancel', v_owner);
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 20 then
    raise exception 'ASSERT FAIL cancel: expected stock 20 after cancel, got %', v_stock;
  end if;
  select status into v_status from public.invoices where id = v_inv;
  if v_status <> 'cancelled' then
    raise exception 'ASSERT FAIL cancel: invoice status is %', v_status;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where reference_id = v_inv and type = 'REVERSAL' and batch_id is null;
  if v_logs < 1 then
    raise exception 'ASSERT FAIL cancel: no REVERSAL log written';
  end if;
end;
$$;

-- ASSERT: cancel_invoice_with_payments_blocked
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_inv uuid;
  v_accepted boolean := false;
  v_code text;
  v_msg text;
  v_status text;
begin
  v_pid := pg_temp.make_product('Harness PaidCancel', 10, false, 100);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 1, 100, 100));
  begin
    perform public.cancel_invoice_tx(v_inv, 'should fail', v_owner);
    v_accepted := true;
  exception when others then
    v_code := sqlstate;
    v_msg := sqlerrm;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL cancel_paid: paid invoice was cancelled';
  end if;
  if v_code <> '23514' or v_msg <> 'has_payments' then
    raise exception 'ASSERT FAIL cancel_paid: expected 23514 has_payments, got % %', v_code, v_msg;
  end if;
  select status into v_status from public.invoices where id = v_inv;
  if v_status <> 'active' then
    raise exception 'ASSERT FAIL cancel_paid: invoice status changed to %', v_status;
  end if;
end;
$$;

-- ASSERT: convert_quotation_creates_invoice
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_qid uuid;
  v_inv uuid;
  v_qstatus text;
  v_converted uuid;
  v_total numeric;
  v_stock numeric;
begin
  v_pid := pg_temp.make_product('Harness Quote Item', 30, false, 100);
  insert into public.quotations (
    shop_id, quotation_number, customer_name, subtotal, taxable_amt, total, status
  ) values (v_shop, 'QT-HARNESS-1', 'Quote Customer', 200, 200, 200, 'draft')
  returning id into v_qid;
  insert into public.quotation_items (
    quotation_id, product_id, name, quantity, unit_price, taxable_amt, tax_amt, total
  ) values (v_qid, v_pid, 'Harness Quote Item', 2, 100, 200, 0, 200);
  v_inv := public.convert_quotation_tx(v_qid, v_owner);
  if v_inv is null then
    raise exception 'ASSERT FAIL convert: no invoice returned';
  end if;
  select total into v_total from public.invoices where id = v_inv;
  if v_total <> 200 then
    raise exception 'ASSERT FAIL convert: invoice total is %', v_total;
  end if;
  select status, converted_invoice_id into v_qstatus, v_converted
  from public.quotations where id = v_qid;
  if v_qstatus <> 'converted' or v_converted <> v_inv then
    raise exception 'ASSERT FAIL convert: quotation is % with converted %', v_qstatus, v_converted;
  end if;
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 28 then
    raise exception 'ASSERT FAIL convert: expected stock 28, got %', v_stock;
  end if;
end;
$$;

-- ASSERT: next_document_number_quotation
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_before int;
  v_after int;
  v_num text;
begin
  select quotation_counter into v_before from public.shops where id = v_shop;
  v_num := public.next_document_number(v_shop, 'quotation');
  select quotation_counter into v_after from public.shops where id = v_shop;
  if v_after <> v_before + 1 then
    raise exception 'ASSERT FAIL next_number: counter went % to %', v_before, v_after;
  end if;
  if v_num <> 'QT-' || (v_before + 1)::text then
    raise exception 'ASSERT FAIL next_number: expected QT-%, got %', v_before + 1, v_num;
  end if;
end;
$$;

-- ASSERT: adjust_stock_writes_audit_log
do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_stock numeric;
  v_logs int;
begin
  v_pid := pg_temp.make_product('Harness Adjust', 10, false, 100);
  perform public.adjust_stock_tx(v_pid, 25, 'AUDIT', 'harness audit', v_owner);
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 25 then
    raise exception 'ASSERT FAIL adjust_stock: expected 25, got %', v_stock;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where product_id = v_pid and type = 'AUDIT' and new_stock = 25;
  if v_logs <> 1 then
    raise exception 'ASSERT FAIL adjust_stock: expected 1 AUDIT log, got %', v_logs;
  end if;
end;
$$;

-- ASSERT: accept_staff_invite_activates_manager
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'manager@demo.billdost.local')
on conflict (id) do nothing;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select set_config('test.email', 'manager@demo.billdost.local', false);
do $$
declare
  v_shop uuid;
  v_status text;
  v_uid uuid;
begin
  v_shop := public.accept_staff_invite();
  if v_shop <> '22222222-2222-2222-2222-222222222222'::uuid then
    raise exception 'ASSERT FAIL accept_invite: returned shop %', v_shop;
  end if;
  select status, user_id into v_status, v_uid from public.staff_members
  where shop_id = v_shop and email = 'manager@demo.billdost.local';
  if v_status <> 'active' then
    raise exception 'ASSERT FAIL accept_invite: manager status is %', v_status;
  end if;
  if v_uid <> '33333333-3333-3333-3333-333333333333'::uuid then
    raise exception 'ASSERT FAIL accept_invite: manager user_id is %', v_uid;
  end if;
end;
$$;
select set_config('test.uid', '', false);
select set_config('test.email', '', false);

-- ASSERT: rls_stranger_sees_nothing
insert into auth.users (id, email)
values ('99999999-9999-9999-9999-999999999999', 'stranger@test.local')
on conflict (id) do nothing;
select set_config('test.uid', '99999999-9999-9999-9999-999999999999', false);
select set_config('test.email', 'stranger@test.local', false);
set role authenticated;
do $$
declare
  v_count int;
  v_denied boolean := false;
begin
  select count(*) into v_count from public.invoices;
  if v_count <> 0 then
    raise exception 'ASSERT FAIL rls: stranger saw % invoices', v_count;
  end if;
  begin
    insert into public.invoices (shop_id, invoice_number, customer_name)
    values ('22222222-2222-2222-2222-222222222222', 'HACK-1', 'Stranger');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'ASSERT FAIL rls: stranger direct insert was not denied';
  end if;
end;
$$;
reset role;
select set_config('test.uid', '', false);
select set_config('test.email', '', false);

-- ASSERT: batch_add_and_writeoff
do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_batch uuid;
  v_qty numeric;
  v_stock numeric;
  v_logs int;
begin
  v_pid := pg_temp.make_product('Harness Batch Product', 10, true, 100);
  v_batch := public.add_product_batch_tx(
    v_pid, 'B-TEST-1', current_date + 30, 120, 90, 5, v_owner);
  select qty into v_qty from public.product_batches where id = v_batch;
  if v_qty <> 5 then
    raise exception 'ASSERT FAIL batch_add: batch qty is %', v_qty;
  end if;
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 15 then
    raise exception 'ASSERT FAIL batch_add: product stock is %', v_stock;
  end if;
  perform public.write_off_batch_tx(v_batch, v_owner);
  select qty into v_qty from public.product_batches where id = v_batch;
  if v_qty <> 0 then
    raise exception 'ASSERT FAIL writeoff: batch qty is %', v_qty;
  end if;
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 10 then
    raise exception 'ASSERT FAIL writeoff: product stock is %', v_stock;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where batch_id = v_batch and type = 'EXPIRY_WRITEOFF';
  if v_logs <> 1 then
    raise exception 'ASSERT FAIL writeoff: expected 1 EXPIRY_WRITEOFF log, got %', v_logs;
  end if;
end;
$$;

-- ASSERT: fefo_single_batch_covers_line
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_batch uuid;
  v_inv uuid;
  v_qty numeric;
  v_item_batch uuid;
  v_allocs int;
  v_alloc_qty numeric;
  v_logs int;
begin
  v_pid := pg_temp.make_product('FEFO Single', 100, true, 100);
  v_batch := pg_temp.make_batch(v_pid, 'F1-B1', 10, current_date + 30);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 4, 100, 0));
  select qty into v_qty from public.product_batches where id = v_batch;
  if v_qty <> 6 then
    raise exception 'ASSERT FAIL F1: batch qty is %, expected 6', v_qty;
  end if;
  select batch_id into v_item_batch from public.invoice_items where invoice_id = v_inv;
  if v_item_batch <> v_batch then
    raise exception 'ASSERT FAIL F1: invoice_items.batch_id is %, expected %', v_item_batch, v_batch;
  end if;
  select count(*), coalesce(sum(qty), 0) into v_allocs, v_alloc_qty
  from public.invoice_batch_allocations where invoice_id = v_inv;
  if v_allocs <> 1 or v_alloc_qty <> 4 then
    raise exception 'ASSERT FAIL F1: allocations % rows totalling %', v_allocs, v_alloc_qty;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where reference_id = v_inv and batch_id = v_batch and type = 'SALE';
  if v_logs <> 1 then
    raise exception 'ASSERT FAIL F1: batch SALE logs = %', v_logs;
  end if;
end;
$$;

-- ASSERT: fefo_split_across_two_batches
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_a uuid;
  v_b uuid;
  v_inv uuid;
  v_qty_a numeric;
  v_qty_b numeric;
  v_item_batch uuid;
  v_allocs int;
begin
  v_pid := pg_temp.make_product('FEFO Split', 100, true, 100);
  v_a := pg_temp.make_batch(v_pid, 'F2-EARLY', 3, current_date + 10);
  v_b := pg_temp.make_batch(v_pid, 'F2-LATE', 10, current_date + 60);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 5, 100, 0));
  select qty into v_qty_a from public.product_batches where id = v_a;
  select qty into v_qty_b from public.product_batches where id = v_b;
  if v_qty_a <> 0 then
    raise exception 'ASSERT FAIL F2: earliest batch qty is %, expected 0', v_qty_a;
  end if;
  if v_qty_b <> 8 then
    raise exception 'ASSERT FAIL F2: second batch qty is %, expected 8', v_qty_b;
  end if;
  select count(*) into v_allocs from public.invoice_batch_allocations where invoice_id = v_inv;
  if v_allocs <> 2 then
    raise exception 'ASSERT FAIL F2: allocations = %, expected 2', v_allocs;
  end if;
  select batch_id into v_item_batch from public.invoice_items where invoice_id = v_inv;
  if v_item_batch is not null then
    raise exception 'ASSERT FAIL F2: invoice_items.batch_id should be null, got %', v_item_batch;
  end if;
  insert into harness_state (k, v) values
    ('f2_invoice', v_inv), ('f2_batch_a', v_a), ('f2_batch_b', v_b), ('f2_product', v_pid)
  on conflict (k) do update set v = excluded.v;
end;
$$;

-- ASSERT: fefo_expired_batch_skipped
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_exp uuid;
  v_fresh uuid;
  v_inv uuid;
  v_qty_exp numeric;
  v_qty_fresh numeric;
  v_allocs int;
begin
  v_pid := pg_temp.make_product('FEFO Expired', 100, true, 100);
  v_exp := pg_temp.make_batch(v_pid, 'F3-EXPIRED', 10, current_date - 1);
  v_fresh := pg_temp.make_batch(v_pid, 'F3-FRESH', 10, current_date + 30);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 4, 100, 0));
  select qty into v_qty_exp from public.product_batches where id = v_exp;
  select qty into v_qty_fresh from public.product_batches where id = v_fresh;
  if v_qty_exp <> 10 then
    raise exception 'ASSERT FAIL F3: expired batch qty is %, expected 10', v_qty_exp;
  end if;
  if v_qty_fresh <> 6 then
    raise exception 'ASSERT FAIL F3: fresh batch qty is %, expected 6', v_qty_fresh;
  end if;
  select count(*) into v_allocs from public.invoice_batch_allocations
  where invoice_id = v_inv and batch_id = v_exp;
  if v_allocs <> 0 then
    raise exception 'ASSERT FAIL F3: expired batch got % allocations', v_allocs;
  end if;
end;
$$;

-- ASSERT: fefo_partial_allocation_sale_succeeds
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_batch uuid;
  v_inv uuid;
  v_qty numeric;
  v_alloc_qty numeric;
  v_stock numeric;
begin
  v_pid := pg_temp.make_product('FEFO Partial', 100, true, 100);
  v_batch := pg_temp.make_batch(v_pid, 'F4-B1', 2, current_date + 30);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 5, 100, 0));
  if v_inv is null then
    raise exception 'ASSERT FAIL F4: sale did not return an invoice';
  end if;
  select qty into v_qty from public.product_batches where id = v_batch;
  if v_qty <> 0 then
    raise exception 'ASSERT FAIL F4: batch qty is %, expected 0', v_qty;
  end if;
  select coalesce(sum(qty), 0) into v_alloc_qty
  from public.invoice_batch_allocations where invoice_id = v_inv;
  if v_alloc_qty <> 2 then
    raise exception 'ASSERT FAIL F4: allocated qty is %, expected 2', v_alloc_qty;
  end if;
  select stock_qty into v_stock from public.products where id = v_pid;
  if v_stock <> 95 then
    raise exception 'ASSERT FAIL F4: product stock is %, expected 95', v_stock;
  end if;
end;
$$;

-- ASSERT: fefo_untracked_product_no_allocation
do $$
declare
  v_shop uuid := '22222222-2222-2222-2222-222222222222';
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_pid uuid;
  v_batch uuid;
  v_inv uuid;
  v_qty numeric;
  v_allocs int;
begin
  v_pid := pg_temp.make_product('FEFO Untracked', 100, false, 100);
  v_batch := pg_temp.make_batch(v_pid, 'F5-B1', 10, current_date + 30);
  v_inv := public.create_invoice_tx(v_shop, v_owner, pg_temp.payload(v_pid, 4, 100, 0));
  select qty into v_qty from public.product_batches where id = v_batch;
  if v_qty <> 10 then
    raise exception 'ASSERT FAIL F5: batch qty is %, expected 10', v_qty;
  end if;
  select count(*) into v_allocs from public.invoice_batch_allocations where invoice_id = v_inv;
  if v_allocs <> 0 then
    raise exception 'ASSERT FAIL F5: allocations = %, expected 0', v_allocs;
  end if;
end;
$$;

-- ASSERT: fefo_cancel_restores_batches
do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_inv uuid;
  v_a uuid;
  v_b uuid;
  v_qty_a numeric;
  v_qty_b numeric;
  v_logs int;
begin
  select v into v_inv from harness_state where k = 'f2_invoice';
  select v into v_a from harness_state where k = 'f2_batch_a';
  select v into v_b from harness_state where k = 'f2_batch_b';
  if v_inv is null or v_a is null or v_b is null then
    raise exception 'ASSERT FAIL F6: F2 fixtures missing from harness_state';
  end if;
  perform public.cancel_invoice_tx(v_inv, 'harness fefo cancel', v_owner);
  select qty into v_qty_a from public.product_batches where id = v_a;
  select qty into v_qty_b from public.product_batches where id = v_b;
  if v_qty_a <> 3 then
    raise exception 'ASSERT FAIL F6: batch A qty is %, expected 3', v_qty_a;
  end if;
  if v_qty_b <> 10 then
    raise exception 'ASSERT FAIL F6: batch B qty is %, expected 10', v_qty_b;
  end if;
  select count(*) into v_logs from public.inventory_logs
  where reference_id = v_inv and type = 'REVERSAL' and batch_id is not null;
  if v_logs <> 2 then
    raise exception 'ASSERT FAIL F6: batch REVERSAL logs = %, expected 2', v_logs;
  end if;
end;
$$;

-- ASSERT: admin_create_shop_requires_active_admin
do $$
declare
  v_code text;
  v_accepted boolean;
  v_payload jsonb := '{"shop_name":"Guard Test","owner_name":"G","owner_mobile":"9000000001"}'::jsonb;
begin
  insert into auth.users (id, email) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'founder@billdost.test'),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'finance@billdost.test'),
    ('aaaaaaaa-0000-0000-0000-000000000003', 'disabled@billdost.test')
  on conflict (id) do nothing;
  insert into public.admin_users (id, auth_user_id, display_name, email, role, status) values
    ('a1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Founder', 'founder@billdost.test', 'founder', 'active'),
    ('a1111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Finance', 'finance@billdost.test', 'finance', 'active'),
    ('a1111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'Disabled', 'disabled@billdost.test', 'founder', 'disabled')
  on conflict (id) do nothing;

  -- Unknown admin id.
  v_accepted := false; v_code := null;
  begin
    perform public.admin_create_shop_tx('a9999999-0000-0000-0000-000000000009', v_payload);
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted or v_code <> '28000' then
    raise exception 'ASSERT FAIL admin guard: unknown admin accepted or wrong code %', v_code;
  end if;

  -- Finance role may not create shops.
  v_accepted := false; v_code := null;
  begin
    perform public.admin_create_shop_tx('a1111111-0000-0000-0000-000000000002', v_payload);
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted or v_code <> '42501' then
    raise exception 'ASSERT FAIL admin guard: finance admin accepted or wrong code %', v_code;
  end if;

  -- Disabled admin may not create shops.
  v_accepted := false; v_code := null;
  begin
    perform public.admin_create_shop_tx('a1111111-0000-0000-0000-000000000003', v_payload);
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted or v_code <> '28000' then
    raise exception 'ASSERT FAIL admin guard: disabled admin accepted or wrong code %', v_code;
  end if;
end;
$$;

-- ASSERT: admin_create_shop_happy_path
do $$
declare
  v_shop uuid;
  v_status text;
  v_owner uuid;
  v_login text;
  v_staff_status text;
  v_products int;
  v_req_status text;
  v_req_shop uuid;
  v_audit int;
begin
  insert into public.access_requests (id, shop_name, owner_name, whatsapp_number, category, city, status)
  values ('cccccccc-0000-0000-0000-000000000001', 'Ramdev Kirana', 'Ramdev Ji', '919876543210', 'kirana', 'Jaipur', 'approved');

  v_shop := public.admin_create_shop_tx(
    'a1111111-0000-0000-0000-000000000001',
    jsonb_build_object(
      'shop_name', 'Ramdev Kirana',
      'category', 'kirana',
      'address', 'Main Bazaar, Jaipur',
      'owner_name', 'Ramdev Ji',
      'owner_mobile', '+91 98765 43210',
      'request_id', 'cccccccc-0000-0000-0000-000000000001',
      'products', jsonb_build_array(
        jsonb_build_object('name', 'Atta 10kg', 'price', 425, 'unit', 'piece'),
        jsonb_build_object('name', 'Sugar 1kg', 'price', 45, 'unit', 'piece')
      ),
      'staff', jsonb_build_array(
        jsonb_build_object('name', 'Helper One', 'phone', '9000000002', 'role', 'billing')
      )
    )
  );

  select status, owner_id into v_status, v_owner from public.shops where id = v_shop;
  if v_status <> 'pending_activation' then
    raise exception 'ASSERT FAIL admin create: shop status %, expected pending_activation', v_status;
  end if;
  if v_owner is not null then
    raise exception 'ASSERT FAIL admin create: owner_id must be NULL before activation';
  end if;

  select email, status into v_login, v_staff_status
  from public.staff_members where shop_id = v_shop and role = 'owner';
  if v_login <> '9876543210@billdost.in' then
    raise exception 'ASSERT FAIL admin create: login email %, expected generated mobile id', v_login;
  end if;
  if v_staff_status <> 'invited' then
    raise exception 'ASSERT FAIL admin create: owner staff status %, expected invited', v_staff_status;
  end if;

  select count(*) into v_products from public.products where shop_id = v_shop;
  if v_products <> 2 then
    raise exception 'ASSERT FAIL admin create: products %, expected 2', v_products;
  end if;

  select status, converted_shop_id into v_req_status, v_req_shop
  from public.access_requests where id = 'cccccccc-0000-0000-0000-000000000001';
  if v_req_status <> 'setup_done' or v_req_shop <> v_shop then
    raise exception 'ASSERT FAIL admin create: request not moved to setup_done with shop link';
  end if;

  select count(*) into v_audit from public.admin_audit_log
  where shop_id = v_shop and action = 'shop_created';
  if v_audit <> 1 then
    raise exception 'ASSERT FAIL admin create: audit rows %, expected 1', v_audit;
  end if;

  insert into harness_state (k, v) values ('admin_shop_1', v_shop)
  on conflict (k) do update set v = excluded.v;
end;
$$;

-- ASSERT: activation_issue_and_replace
do $$
declare
  v_shop uuid;
  v_state text;
  v_code text;
  v_accepted boolean;
begin
  select v into v_shop from harness_state where k = 'admin_shop_1';
  if v_shop is null then
    raise exception 'ASSERT FAIL activation: admin_shop_1 fixture missing';
  end if;

  perform public.admin_issue_activation_tx(
    'a1111111-0000-0000-0000-000000000001', v_shop, 'hash-a', 'manual');
  v_state := public.activation_lookup('hash-a') ->> 'state';
  if v_state <> 'valid' then
    raise exception 'ASSERT FAIL activation: first token state %, expected valid', v_state;
  end if;

  perform public.admin_issue_activation_tx(
    'a1111111-0000-0000-0000-000000000001', v_shop, 'hash-b', 'whatsapp');
  v_state := public.activation_lookup('hash-a') ->> 'state';
  if v_state <> 'replaced' then
    raise exception 'ASSERT FAIL activation: old token state %, expected replaced', v_state;
  end if;

  v_accepted := false; v_code := null;
  begin
    perform public.activation_consume_tx('hash-a', 'bbbbbbbb-0000-0000-0000-000000000001');
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL activation: replaced token was consumed';
  end if;
end;
$$;

-- ASSERT: activation_consume_happy_path
do $$
declare
  v_shop uuid;
  v_returned uuid;
  v_status text;
  v_owner uuid;
  v_staff_status text;
  v_staff_user uuid;
  v_used timestamptz;
  v_req_status text;
  v_audit int;
  v_lookup jsonb;
begin
  select v into v_shop from harness_state where k = 'admin_shop_1';
  insert into auth.users (id, email)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '9876543210@billdost.in')
  on conflict (id) do nothing;

  v_lookup := public.activation_lookup('hash-b');
  if v_lookup ->> 'state' <> 'valid' then
    raise exception 'ASSERT FAIL consume: lookup state %, expected valid', v_lookup ->> 'state';
  end if;
  if v_lookup ->> 'login_email' <> '9876543210@billdost.in' then
    raise exception 'ASSERT FAIL consume: lookup login email %', v_lookup ->> 'login_email';
  end if;

  v_returned := public.activation_consume_tx('hash-b', 'bbbbbbbb-0000-0000-0000-000000000001');
  if v_returned <> v_shop then
    raise exception 'ASSERT FAIL consume: returned shop % does not match', v_returned;
  end if;

  select status, owner_id into v_status, v_owner from public.shops where id = v_shop;
  if v_status <> 'live' or v_owner <> 'bbbbbbbb-0000-0000-0000-000000000001' then
    raise exception 'ASSERT FAIL consume: shop not live with owner set';
  end if;

  select status, user_id into v_staff_status, v_staff_user
  from public.staff_members where shop_id = v_shop and role = 'owner';
  if v_staff_status <> 'active' or v_staff_user <> 'bbbbbbbb-0000-0000-0000-000000000001' then
    raise exception 'ASSERT FAIL consume: owner staff row not activated';
  end if;

  select used_at into v_used from public.activation_tokens where token_hash = 'hash-b';
  if v_used is null then
    raise exception 'ASSERT FAIL consume: token not marked used';
  end if;

  select status into v_req_status from public.access_requests
  where id = 'cccccccc-0000-0000-0000-000000000001';
  if v_req_status <> 'live' then
    raise exception 'ASSERT FAIL consume: request status %, expected live', v_req_status;
  end if;

  select count(*) into v_audit from public.admin_audit_log
  where shop_id = v_shop and action = 'shop_activated';
  if v_audit <> 1 then
    raise exception 'ASSERT FAIL consume: shop_activated audit rows %, expected 1', v_audit;
  end if;
end;
$$;

-- ASSERT: activation_single_use
do $$
declare
  v_code text;
  v_accepted boolean := false;
  v_state text;
begin
  begin
    perform public.activation_consume_tx('hash-b', 'bbbbbbbb-0000-0000-0000-000000000001');
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL single use: token consumed twice';
  end if;
  v_state := public.activation_lookup('hash-b') ->> 'state';
  if v_state <> 'used' then
    raise exception 'ASSERT FAIL single use: lookup state %, expected used', v_state;
  end if;
end;
$$;

-- ASSERT: activation_expired_rejected
do $$
declare
  v_shop uuid;
  v_state text;
  v_accepted boolean := false;
begin
  v_shop := public.admin_create_shop_tx(
    'a1111111-0000-0000-0000-000000000001',
    '{"shop_name":"Expiry Test","owner_name":"E","owner_mobile":"9000000003"}'::jsonb
  );
  perform public.admin_issue_activation_tx(
    'a1111111-0000-0000-0000-000000000001', v_shop, 'hash-c', 'manual');
  update public.activation_tokens
  set expires_at = now() - interval '1 hour'
  where token_hash = 'hash-c';

  v_state := public.activation_lookup('hash-c') ->> 'state';
  if v_state <> 'expired' then
    raise exception 'ASSERT FAIL expiry: lookup state %, expected expired', v_state;
  end if;

  begin
    perform public.activation_consume_tx('hash-c', 'bbbbbbbb-0000-0000-0000-000000000001');
    v_accepted := true;
  exception when others then null;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL expiry: expired token was consumed';
  end if;
end;
$$;

-- ASSERT: activation_invalid_hash
do $$
declare
  v_state text;
  v_accepted boolean := false;
begin
  v_state := public.activation_lookup('no-such-hash') ->> 'state';
  if v_state <> 'invalid' then
    raise exception 'ASSERT FAIL invalid: lookup state %, expected invalid', v_state;
  end if;
  begin
    perform public.activation_consume_tx('no-such-hash', 'bbbbbbbb-0000-0000-0000-000000000001');
    v_accepted := true;
  exception when others then null;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL invalid: unknown token was consumed';
  end if;
end;
$$;

-- ASSERT: team_theme_presence_and_support_fixture
do $$
declare
  v_theme text;
  v_active timestamptz;
begin
  insert into auth.users (id, email) values
    ('aaaaaaaa-0000-0000-0000-000000000004', 'support@billdost.test')
  on conflict (id) do nothing;
  insert into public.admin_users (id, auth_user_id, display_name, email, role, status) values
    ('a1111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'Support', 'support@billdost.test', 'support', 'active')
  on conflict (id) do nothing;

  update public.admin_users
  set ui_theme = 'dark', last_active_at = now()
  where id = 'a1111111-0000-0000-0000-000000000001';
  select ui_theme, last_active_at into v_theme, v_active
  from public.admin_users
  where id = 'a1111111-0000-0000-0000-000000000001';
  if v_theme <> 'dark' or v_active is null then
    raise exception 'ASSERT FAIL theme/presence: theme %, active %', v_theme, v_active;
  end if;

  begin
    update public.admin_users set ui_theme = 'auto'
    where id = 'a1111111-0000-0000-0000-000000000001';
    raise exception 'ASSERT FAIL theme: invalid ui_theme accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- ASSERT: approval_gate_support_shop_waits
do $$
declare
  v_shop uuid;
  v_status text;
  v_approved int;
begin
  v_shop := public.admin_create_shop_tx(
    'a1111111-0000-0000-0000-000000000004',
    '{"shop_name":"Gate Support Shop","owner_name":"S","owner_mobile":"9000000011"}'::jsonb
  );
  select status into v_status from public.shops where id = v_shop;
  if v_status <> 'awaiting_approval' then
    raise exception 'ASSERT FAIL gate: support-created shop status %, expected awaiting_approval', v_status;
  end if;
  select count(*) into v_approved from public.admin_audit_log
  where shop_id = v_shop and action = 'shop_approved';
  if v_approved <> 0 then
    raise exception 'ASSERT FAIL gate: support shop has an approval row';
  end if;
  insert into harness_state (k, v) values ('gate_support_shop', v_shop)
  on conflict (k) do update set v = excluded.v;
end;
$$;

-- ASSERT: approval_gate_token_blocked_until_approved
do $$
declare
  v_shop uuid;
  v_code text;
  v_accepted boolean;
  v_hash text := 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
begin
  select v into v_shop from harness_state where k = 'gate_support_shop';

  -- The founder himself cannot issue a link for an unapproved shop.
  v_accepted := false; v_code := null;
  begin
    perform public.admin_issue_activation_tx(
      'a1111111-0000-0000-0000-000000000001', v_shop, v_hash, 'manual');
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted or v_code <> 'P0001' then
    raise exception 'ASSERT FAIL gate: founder issued token for awaiting_approval shop, code %', v_code;
  end if;

  -- Support may not issue links at all (role check fires first).
  v_accepted := false; v_code := null;
  begin
    perform public.admin_issue_activation_tx(
      'a1111111-0000-0000-0000-000000000004', v_shop, v_hash, 'manual');
    v_accepted := true;
  exception when others then v_code := sqlstate;
  end;
  if v_accepted or v_code <> '42501' then
    raise exception 'ASSERT FAIL gate: support issued a token, code %', v_code;
  end if;

  if exists (select 1 from public.activation_tokens where shop_id = v_shop) then
    raise exception 'ASSERT FAIL gate: a token row exists for an unapproved shop';
  end if;
end;
$$;

-- ASSERT: approval_gate_approve_then_issue_works
do $$
declare
  v_shop uuid;
  v_token uuid;
  v_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
begin
  select v into v_shop from harness_state where k = 'gate_support_shop';

  -- The founder approval step (the portal does this via its API;
  -- here the state move itself is what the gate depends on).
  update public.shops set status = 'pending_activation' where id = v_shop;

  v_token := public.admin_issue_activation_tx(
    'a1111111-0000-0000-0000-000000000001', v_shop, v_hash, 'whatsapp');
  if v_token is null then
    raise exception 'ASSERT FAIL gate: no token after approval';
  end if;
end;
$$;

-- ASSERT: approval_gate_founder_shop_inline_approved
do $$
declare
  v_shop uuid;
  v_status text;
  v_approved int;
begin
  v_shop := public.admin_create_shop_tx(
    'a1111111-0000-0000-0000-000000000001',
    '{"shop_name":"Gate Founder Shop","owner_name":"F","owner_mobile":"9000000012"}'::jsonb
  );
  select status into v_status from public.shops where id = v_shop;
  if v_status <> 'pending_activation' then
    raise exception 'ASSERT FAIL gate: founder-created shop status %, expected pending_activation', v_status;
  end if;
  select count(*) into v_approved from public.admin_audit_log
  where shop_id = v_shop and action = 'shop_approved'
    and (details ->> 'inline') = 'true';
  if v_approved <> 1 then
    raise exception 'ASSERT FAIL gate: inline approval not audit-logged';
  end if;
end;
$$;

-- ASSERT: assignment_claim_and_call_log_flow
do $$
declare
  v_req uuid;
  v_assignee uuid;
  v_started timestamptz;
  v_calls int;
  v_accepted boolean;
begin
  insert into public.access_requests (shop_name, owner_name, whatsapp_number, category, created_at)
  values ('Assign Test Store', 'A Owner', '9000000021', 'kirana', now() - interval '3 hours')
  returning id into v_req;

  update public.access_requests
  set assignee_id = 'a1111111-0000-0000-0000-000000000004',
      claimed_at = now(), started_at = now()
  where id = v_req;
  select assignee_id, started_at into v_assignee, v_started
  from public.access_requests where id = v_req;
  if v_assignee <> 'a1111111-0000-0000-0000-000000000004' or v_started is null then
    raise exception 'ASSERT FAIL assign: request assignment did not stick';
  end if;

  insert into public.call_logs (admin_id, request_id, outcome, note)
  values ('a1111111-0000-0000-0000-000000000004', v_req, 'answered', 'Spoke to owner');
  select count(*) into v_calls from public.call_logs where request_id = v_req;
  if v_calls <> 1 then
    raise exception 'ASSERT FAIL call log: expected 1 row, got %', v_calls;
  end if;

  v_accepted := false;
  begin
    insert into public.call_logs (admin_id, request_id, outcome)
    values ('a1111111-0000-0000-0000-000000000004', v_req, 'shouted');
    v_accepted := true;
  exception when check_violation then null;
  end;
  if v_accepted then
    raise exception 'ASSERT FAIL call log: invalid outcome accepted';
  end if;

  -- Attention smoke: the seeded request is findable by the exact
  -- columns the attention engine reads (status, assignee, stamps).
  if not exists (
    select 1 from public.access_requests
    where id = v_req and status = 'new' and assignee_id is not null
  ) then
    raise exception 'ASSERT FAIL attention smoke: seeded request not readable';
  end if;
end;
$$;

select 'HARNESS_ASSERTIONS_COMPLETE' as pass_marker;
