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

select 'HARNESS_ASSERTIONS_COMPLETE' as pass_marker;
