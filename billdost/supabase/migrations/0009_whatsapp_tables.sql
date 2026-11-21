-- 0009: WhatsApp Cloud API tables (blueprint B.2 Phase 0 additions).
-- The whatsapp-web.js microservice is replaced by the Meta Cloud API in
-- Stage 2; these tables are its system of record. Sends are written by
-- the service role only (the send path), reads are manager and owner.

create table public.whatsapp_connections (
  shop_id uuid primary key references public.shops(id) on delete restrict,
  phone_number_id text,
  waba_id text,
  display_phone text,
  access_token_ref text,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_sends (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  to_phone text not null,
  template_name text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_sends_shop_created_idx
  on public.whatsapp_sends (shop_id, created_at desc);
create index whatsapp_sends_invoice_idx
  on public.whatsapp_sends (invoice_id) where invoice_id is not null;

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_sends enable row level security;

create policy whatsapp_connections_select_manager on public.whatsapp_connections
  for select to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy whatsapp_connections_insert_manager on public.whatsapp_connections
  for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy whatsapp_connections_update_manager on public.whatsapp_connections
  for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));

create policy whatsapp_sends_select_manager on public.whatsapp_sends
  for select to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));
-- No insert or update policy for whatsapp_sends: writes are service-role
-- only, from the send path and the webhook handler.

create trigger whatsapp_connections_set_updated_at
  before update on public.whatsapp_connections
  for each row execute function app.set_updated_at();

create trigger whatsapp_sends_set_updated_at
  before update on public.whatsapp_sends
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.whatsapp_connections to authenticated;
grant all on public.whatsapp_connections to service_role;
grant select, insert, update, delete on public.whatsapp_sends to authenticated;
grant all on public.whatsapp_sends to service_role;
