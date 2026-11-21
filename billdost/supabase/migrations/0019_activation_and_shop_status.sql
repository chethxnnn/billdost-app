-- 0019: Shop lifecycle status and activation tokens (Admin Portal plan,
-- Sections 4 and 5). Two changes to shops, then the token table.
--
-- 1. shops.status. Until now a shop simply existed. The portal needs the
--    lifecycle in one vocabulary, the same words in the database, the
--    portal screens and the plan: pending_activation, live, suspended.
--    The default is 'live' so every shop that already exists (created
--    through the old wizard, where the owner was present at creation)
--    is live the moment this column lands. Only portal-created shops
--    start at pending_activation, set explicitly by
--    admin_create_shop_tx (0021).
--
-- 2. shops.owner_id becomes nullable. A portal-created shop has no
--    owner auth account until the owner activates through the link:
--    the auth user is created at activation time and only then becomes
--    shops.owner_id. app.current_shop_ids() already tolerates this: a
--    NULL owner_id matches nobody, and the owner staff row carries
--    user_id NULL until activation fills it.
--
-- 3. activation_tokens. One row per link issued. The raw token is a
--    32-byte random value generated on the server; only its SHA-256
--    hash is stored here, in token_hash, unique. There is deliberately
--    no raw token column. A link lives 72 hours, works once, and dies
--    the moment a newer link is issued for the same shop
--    (replaced_at). failed_attempts counts presentations of a token
--    that was already dead (used, replaced or expired), which is the
--    signal the portal shows when links are being probed.

alter table public.shops
  add column status text not null default 'live'
    check (status in ('pending_activation', 'live', 'suspended'));
alter table public.shops
  add column suspended_reason text;
alter table public.shops
  add column suspended_at timestamptz;
alter table public.shops
  add column activated_at timestamptz;

alter table public.shops alter column owner_id drop not null;

create table public.activation_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  token_hash text not null unique,
  intended_owner_name text,
  intended_owner_mobile text,
  intended_login_email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  replaced_at timestamptz,
  failed_attempts int not null default 0,
  send_channel text check (send_channel in ('whatsapp', 'manual')),
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index activation_tokens_shop_created_idx
  on public.activation_tokens (shop_id, created_at desc);
-- At most one live link per shop, enforced by the database, not only
-- by the issuing function.
create unique index activation_tokens_one_live_per_shop
  on public.activation_tokens (shop_id)
  where used_at is null and replaced_at is null;

alter table public.activation_tokens enable row level security;

revoke all on public.activation_tokens from anon, authenticated;
grant all on public.activation_tokens to service_role;
