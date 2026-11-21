-- 0012: Phase 3 tables (blueprint B.2) and the multi-shop unlock.
-- Loyalty ledger, recurring invoice rules, branches, and the public
-- store settings. RLS and grants ship in the same file.

create table public.loyalty_points (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  points int not null,
  kind text not null check (kind in ('earn', 'redeem', 'adjust', 'expire')),
  note text,
  created_at timestamptz not null default now()
);

create table public.recurring_invoice_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_run_date date not null,
  template jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_branches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  address text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  shop_id uuid primary key references public.shops(id) on delete restrict,
  is_public boolean not null default false,
  tagline text,
  banner_url text,
  whatsapp_ordering boolean not null default false,
  updated_at timestamptz not null default now()
);

create index loyalty_points_shop_customer_idx
  on public.loyalty_points (shop_id, customer_id, created_at desc);
create index recurring_invoice_rules_due_idx
  on public.recurring_invoice_rules (next_run_date) where is_active;

-- Multi-shop unlock (blueprint B.2 note): drop the Phase 0 one-shop-per
-- owner index. Owners also get an explicit staff_members row per shop;
-- app.current_shop_ids() keeps its owner union regardless, this row
-- exists so staff lists and role checks see the owner too.
drop index if exists public.shops_owner_unique_phase0;

insert into public.staff_members (shop_id, user_id, email, name, role, status)
select id, owner_id, email, name, 'owner', 'active'
from public.shops
on conflict do nothing;

alter table public.loyalty_points enable row level security;
alter table public.recurring_invoice_rules enable row level security;
alter table public.shop_branches enable row level security;
alter table public.store_settings enable row level security;

create policy loyalty_points_select_member on public.loyalty_points for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy loyalty_points_insert_member on public.loyalty_points for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

create policy recurring_invoice_rules_select_member on public.recurring_invoice_rules for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy recurring_invoice_rules_insert_manager on public.recurring_invoice_rules for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy recurring_invoice_rules_update_manager on public.recurring_invoice_rules for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy shop_branches_select_member on public.shop_branches for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy shop_branches_insert_manager on public.shop_branches for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy shop_branches_update_manager on public.shop_branches for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy store_settings_select_member on public.store_settings for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy store_settings_insert_manager on public.store_settings for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy store_settings_update_manager on public.store_settings for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
-- The public store page reads store_settings through a dedicated
-- security definer RPC added with the store feature, not a table grant.

create trigger recurring_invoice_rules_set_updated_at
  before update on public.recurring_invoice_rules
  for each row execute function app.set_updated_at();
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.loyalty_points to authenticated;
grant all on public.loyalty_points to service_role;
grant select, insert, update, delete on public.recurring_invoice_rules to authenticated;
grant all on public.recurring_invoice_rules to service_role;
grant select, insert, update, delete on public.shop_branches to authenticated;
grant all on public.shop_branches to service_role;
grant select, insert, update, delete on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
