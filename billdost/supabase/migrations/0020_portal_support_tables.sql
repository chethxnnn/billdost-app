-- 0020: Portal support tables (Admin Portal plan, Sections 5 and 6):
-- announcements, broadcast_log, shop_support_notes, platform_settings,
-- the Issue Centre status fields on the existing error log, and the
-- finance-lite plan fields on shops.
--
-- The plan names the error table app_error_reports; the table that
-- actually shipped in the shop app build (migration 0015) is
-- public.client_errors, written by POST /api/client-errors. The Issue
-- Centre reads that table. Only its workflow fields are added here:
-- issue_status (new, investigating, fixed, informed) and
-- internal_note. No second error table is created.
--
-- Finance lite (plan Section 6G, v1): shops.plan already exists
-- (free, standard, pro). What was missing is the money side of the
-- subscription: plan_amount, plan_status and plan_next_due. Plan data
-- describes the subscription only; nothing here ever touches a shop's
-- invoices or totals.

-- ------------------------------------------------------------ announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all', 'category', 'shop')),
  category text,
  shop_id uuid references public.shops(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (audience = 'category' and category is not null) or
    (audience = 'shop' and shop_id is not null) or
    (audience = 'all')
  )
);

create index announcements_window_idx
  on public.announcements (starts_at, ends_at);

-- ------------------------------------------------------------ broadcast_log
create table public.broadcast_log (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  audience text not null default 'all'
    check (audience in ('all', 'category', 'shop')),
  category text,
  shop_id uuid references public.shops(id) on delete set null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null default 'sent'
    check (status in ('sent', 'partial', 'failed', 'not_connected')),
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index broadcast_log_created_idx
  on public.broadcast_log (created_at desc);

-- ------------------------------------------------------- shop support notes
-- The team's call notes per shop. Visible to the team, never to the
-- shop: the table has no shop-side policy or grant at all.
create table public.shop_support_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index shop_support_notes_shop_created_idx
  on public.shop_support_notes (shop_id, created_at desc);

-- -------------------------------------------------------- platform settings
-- Key and value pairs the portal edits and the shop app reads through
-- the service role: the support phone shown in the app and on
-- activation pages, the landing URL the closed signup points to.
create table public.platform_settings (
  key text primary key,
  value text not null default '',
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value) values
  ('support_phone', ''),
  ('landing_url', 'https://billdost.in')
on conflict (key) do nothing;

-- ------------------------------------------------- issue centre fields
alter table public.client_errors
  add column issue_status text not null default 'new'
    check (issue_status in ('new', 'investigating', 'fixed', 'informed'));
alter table public.client_errors
  add column internal_note text;

create index client_errors_issue_status_idx
  on public.client_errors (issue_status, created_at desc);

-- ------------------------------------------------------- finance lite
alter table public.shops
  add column plan_amount numeric(12,2) not null default 0;
alter table public.shops
  add column plan_status text not null default 'active'
    check (plan_status in ('trial', 'active', 'due', 'overdue', 'cancelled'));
alter table public.shops
  add column plan_next_due date;

-- ------------------------------------------------------------------ rls
alter table public.announcements enable row level security;
alter table public.broadcast_log enable row level security;
alter table public.shop_support_notes enable row level security;
alter table public.platform_settings enable row level security;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function app.set_updated_at();
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function app.set_updated_at();

revoke all on public.announcements from anon, authenticated;
grant all on public.announcements to service_role;
revoke all on public.broadcast_log from anon, authenticated;
grant all on public.broadcast_log to service_role;
revoke all on public.shop_support_notes from anon, authenticated;
grant all on public.shop_support_notes to service_role;
revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;
