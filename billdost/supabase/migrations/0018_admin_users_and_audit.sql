-- 0018: Admin users and the append-only audit log (Admin Portal plan,
-- Sections 5 and 12). The portal is a separate app used only by the
-- BillDost team. A person may enter it only when their Supabase Auth
-- user has a row here with status 'active'. Roles follow the plan's
-- RBAC table: founder, co_founder, support, finance, analyst.
--
-- admin_audit_log is append-only by construction: RLS is on, there are
-- no update or delete policies for anyone, and the only grant is to the
-- service role, which the portal server uses after checking the acting
-- admin's session and role. admin_user_id is nullable for exactly one
-- reason: system events that no admin performed (a shop activating
-- itself through its link) still belong in the same log.
--
-- The founder is seeded by hand (see admin/README.md): create the auth
-- user in Supabase Auth, then insert one row here with role 'founder'.
-- No email address is hardcoded anywhere in code or SQL.

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null,
  email text not null,
  role text not null
    check (role in ('founder', 'co_founder', 'support', 'finance', 'analyst')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  shop_id uuid references public.shops(id) on delete set null,
  request_id uuid references public.access_requests(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_shop_created_idx
  on public.admin_audit_log (shop_id, created_at desc);
create index admin_audit_log_admin_created_idx
  on public.admin_audit_log (admin_user_id, created_at desc);
create index admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;

create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function app.set_updated_at();

revoke all on public.admin_users from anon, authenticated;
grant all on public.admin_users to service_role;
revoke all on public.admin_audit_log from anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;
