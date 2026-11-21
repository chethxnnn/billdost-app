-- 0017: Access requests from the public landing page (Admin Portal plan,
-- Section 3 and Section 9). BillDost is invite-only: a visitor on
-- billdost.in fills the Request Access form and this table is the ONLY
-- thing that submission creates. No auth account, no shop, no login.
-- The admin portal works the queue: new, called, approved, setup_done,
-- activation_sent, live, rejected.
--
-- Access rules: the landing form endpoint inserts with the service role
-- (it is a server endpoint with honeypot and rate limiting, per the
-- plan). Nobody reads this table from a browser: the portal reads it
-- through role-checked server endpoints. RLS is on with no policies and
-- no grants for anon or authenticated, so a leaked anon key cannot read
-- a single request.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  owner_name text not null,
  whatsapp_number text not null,
  category text not null default 'other',
  city text,
  approx_products int,
  note text,
  status text not null default 'new'
    check (status in ('new', 'called', 'approved', 'setup_done',
                      'activation_sent', 'live', 'rejected')),
  rejection_reason text,
  converted_shop_id uuid references public.shops(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index access_requests_status_created_idx
  on public.access_requests (status, created_at desc);
create index access_requests_converted_shop_idx
  on public.access_requests (converted_shop_id)
  where converted_shop_id is not null;

alter table public.access_requests enable row level security;

create trigger access_requests_set_updated_at
  before update on public.access_requests
  for each row execute function app.set_updated_at();

revoke all on public.access_requests from anon, authenticated;
grant all on public.access_requests to service_role;
