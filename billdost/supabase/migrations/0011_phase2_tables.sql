-- 0011: Phase 2 tables (blueprint B.2): e-invoice and e-way records,
-- CA share links, reminder rules and log, credit and debit notes,
-- delivery challans. RLS and grants ship in the same file.

create table public.einvoice_records (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete restrict,
  irn text,
  ack_no text,
  ack_date timestamptz,
  signed_qr text,
  status text not null default 'pending'
    check (status in ('pending', 'generated', 'cancelled', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.eway_bills (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  eway_no text,
  valid_until timestamptz,
  vehicle_no text,
  transporter_id text,
  distance_km int,
  status text not null default 'pending'
    check (status in ('pending', 'generated', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ca_share_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  token_hash text not null unique,
  label text,
  period_from date,
  period_to date,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  days_after_due int not null,
  channel text not null default 'whatsapp',
  template_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  rule_id uuid references public.reminder_rules(id) on delete set null,
  channel text not null default 'whatsapp',
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  note_number text not null,
  reason text,
  subtotal numeric(12,2) not null default 0,
  tax_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, note_number)
);

create table public.debit_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete set null,
  note_number text not null,
  reason text,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, note_number)
);

create table public.delivery_challans (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  challan_number text not null,
  challan_date date not null default current_date,
  vehicle_no text,
  status text not null default 'open'
    check (status in ('open', 'delivered', 'converted', 'cancelled')),
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, challan_number)
);

create table public.delivery_challan_items (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references public.delivery_challans(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  name text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null default 'piece',
  created_at timestamptz not null default now()
);

create index eway_bills_invoice_idx on public.eway_bills (invoice_id);
create index reminder_log_shop_created_idx on public.reminder_log (shop_id, created_at desc);
create index delivery_challan_items_challan_idx on public.delivery_challan_items (challan_id);

alter table public.einvoice_records enable row level security;
alter table public.eway_bills enable row level security;
alter table public.ca_share_links enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_log enable row level security;
alter table public.credit_notes enable row level security;
alter table public.debit_notes enable row level security;
alter table public.delivery_challans enable row level security;
alter table public.delivery_challan_items enable row level security;

-- Child-of-invoice tables resolve membership through the parent invoice.
create policy einvoice_records_select_member on public.einvoice_records for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = einvoice_records.invoice_id
      and i.shop_id in (select app.current_shop_ids())
  ));

create policy eway_bills_select_member on public.eway_bills for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = eway_bills.invoice_id
      and i.shop_id in (select app.current_shop_ids())
  ));

create policy ca_share_links_select_manager on public.ca_share_links for select to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy ca_share_links_insert_manager on public.ca_share_links for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy ca_share_links_update_manager on public.ca_share_links for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy reminder_rules_select_member on public.reminder_rules for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy reminder_rules_insert_manager on public.reminder_rules for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy reminder_rules_update_manager on public.reminder_rules for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy reminder_log_select_member on public.reminder_log for select to authenticated
  using (shop_id in (select app.current_shop_ids()));

create policy credit_notes_select_member on public.credit_notes for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy credit_notes_insert_manager on public.credit_notes for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy debit_notes_select_member on public.debit_notes for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy debit_notes_insert_manager on public.debit_notes for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy delivery_challans_select_member on public.delivery_challans for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy delivery_challans_insert_member on public.delivery_challans for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));
create policy delivery_challans_update_member on public.delivery_challans for update to authenticated
  using (shop_id in (select app.current_shop_ids()))
  with check (shop_id in (select app.current_shop_ids()));

create policy delivery_challan_items_select_member on public.delivery_challan_items for select to authenticated
  using (exists (
    select 1 from public.delivery_challans c
    where c.id = delivery_challan_items.challan_id
      and c.shop_id in (select app.current_shop_ids())
  ));
create policy delivery_challan_items_insert_member on public.delivery_challan_items for insert to authenticated
  with check (exists (
    select 1 from public.delivery_challans c
    where c.id = delivery_challan_items.challan_id
      and c.shop_id in (select app.current_shop_ids())
  ));

create trigger einvoice_records_set_updated_at
  before update on public.einvoice_records
  for each row execute function app.set_updated_at();
create trigger eway_bills_set_updated_at
  before update on public.eway_bills
  for each row execute function app.set_updated_at();
create trigger delivery_challans_set_updated_at
  before update on public.delivery_challans
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.einvoice_records to authenticated;
grant all on public.einvoice_records to service_role;
grant select, insert, update, delete on public.eway_bills to authenticated;
grant all on public.eway_bills to service_role;
grant select, insert, update, delete on public.ca_share_links to authenticated;
grant all on public.ca_share_links to service_role;
grant select, insert, update, delete on public.reminder_rules to authenticated;
grant all on public.reminder_rules to service_role;
grant select, insert, update, delete on public.reminder_log to authenticated;
grant all on public.reminder_log to service_role;
grant select, insert, update, delete on public.credit_notes to authenticated;
grant all on public.credit_notes to service_role;
grant select, insert, update, delete on public.debit_notes to authenticated;
grant all on public.debit_notes to service_role;
grant select, insert, update, delete on public.delivery_challans to authenticated;
grant all on public.delivery_challans to service_role;
grant select, insert, update, delete on public.delivery_challan_items to authenticated;
grant all on public.delivery_challan_items to service_role;
