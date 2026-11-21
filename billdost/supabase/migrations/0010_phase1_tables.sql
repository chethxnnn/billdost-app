-- 0010: Phase 1 tables (blueprint B.2): product batches, suppliers,
-- purchases, expenses, and the offline sync outbox. RLS and grants ship
-- in the same file, per the post 30 Oct 2026 Data API rule.

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_no text not null,
  expiry_date date,
  mfg_date date,
  qty numeric(12,3) not null default 0,
  cost_price numeric(12,2),
  created_at timestamptz not null default now(),
  unique (shop_id, product_id, batch_no)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  phone text,
  gstin text,
  address text,
  opening_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  bill_number text,
  bill_date date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  tax_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  batch_id uuid references public.product_batches(id) on delete restrict,
  name text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  cost_price numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  category text not null default 'other',
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  note text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  client_mutation_id text not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected')),
  server_invoice_id uuid references public.invoices(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (shop_id, client_mutation_id)
);

-- Batch foreign keys deferred from 0003 (the batches table did not exist).
alter table public.invoice_items
  add constraint invoice_items_batch_fk
  foreign key (batch_id) references public.product_batches(id) on delete restrict;
alter table public.inventory_logs
  add constraint inventory_logs_batch_fk
  foreign key (batch_id) references public.product_batches(id) on delete restrict;

create index product_batches_shop_product_idx
  on public.product_batches (shop_id, product_id, expiry_date);
create index purchases_shop_date_idx
  on public.purchases (shop_id, bill_date desc);
create index purchase_items_purchase_idx
  on public.purchase_items (purchase_id);
create index expenses_shop_date_idx
  on public.expenses (shop_id, expense_date desc);
create index sync_outbox_shop_status_idx
  on public.sync_outbox (shop_id, status, created_at);

-- RLS: same membership pattern as 0005.
alter table public.product_batches enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.expenses enable row level security;
alter table public.sync_outbox enable row level security;

create policy product_batches_select_member on public.product_batches for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy product_batches_insert_manager on public.product_batches for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy product_batches_update_manager on public.product_batches for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy suppliers_select_member on public.suppliers for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy suppliers_insert_manager on public.suppliers for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy suppliers_update_manager on public.suppliers for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy purchases_select_member on public.purchases for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy purchases_insert_manager on public.purchases for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy purchases_update_manager on public.purchases for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy purchase_items_select_member on public.purchase_items for select to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.id = purchase_items.purchase_id
      and p.shop_id in (select app.current_shop_ids())
  ));
create policy purchase_items_insert_manager on public.purchase_items for insert to authenticated
  with check (exists (
    select 1 from public.purchases p
    where p.id = purchase_items.purchase_id
      and app.is_shop_member(p.shop_id, array['owner', 'manager'])
  ));

create policy expenses_select_member on public.expenses for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy expenses_insert_member on public.expenses for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));
create policy expenses_update_manager on public.expenses for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy expenses_delete_manager on public.expenses for delete to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy sync_outbox_select_member on public.sync_outbox for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy sync_outbox_insert_member on public.sync_outbox for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function app.set_updated_at();
create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.product_batches to authenticated;
grant all on public.product_batches to service_role;
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
grant select, insert, update, delete on public.purchases to authenticated;
grant all on public.purchases to service_role;
grant select, insert, update, delete on public.purchase_items to authenticated;
grant all on public.purchase_items to service_role;
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
grant select, insert, update, delete on public.sync_outbox to authenticated;
grant all on public.sync_outbox to service_role;
