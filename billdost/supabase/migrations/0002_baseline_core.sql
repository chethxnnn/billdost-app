-- 0002: Baseline core tables: shops and staff_members (blueprint B.2).
-- On the live project these tables already exist: follow the capture and
-- repair path in blueprint B.7 instead of re-running this file there.
-- Money is numeric(12,2) everywhere. Tax rates are numeric(5,2).

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null,
  category text not null default 'other',
  address text,
  phone text,
  email text,
  gstin text,
  state text not null default '',
  state_code text,
  logo_url text,
  upi_id text,
  upi_qr_url text,
  include_upi_qr_default boolean not null default true,
  language text not null default 'en',
  onboarding_done boolean not null default false,
  invoice_prefix text not null default 'INV',
  invoice_counter int not null default 1000,
  quotation_prefix text not null default 'QT',
  quotation_counter int not null default 100,
  terms_conditions text,
  plan text not null default 'free' check (plan in ('free', 'standard', 'pro')),
  is_gst_registered boolean not null default false,
  round_off boolean not null default true,
  default_due_days int,
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Phase 0 assumption: one shop per owner. Dropped in 0012 (multi-shop).
create unique index shops_owner_unique_phase0 on public.shops (owner_id);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  email text not null,
  name text,
  phone text,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references auth.users(id) on delete restrict,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
