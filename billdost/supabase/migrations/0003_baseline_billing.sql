-- 0003: Baseline billing tables (blueprint B.2): customers, products,
-- invoices, invoice_items, quotations, quotation_items, payments,
-- inventory_logs, activity_log. Includes the Phase 0 columns the money
-- engine needs: customer GSTIN and state, place-of-supply snapshots,
-- round-off, per-line taxable and discount amounts, quotation tax splits.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  tags text[] not null default '{}',
  gstin text,
  state text,
  state_code text,
  opening_balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2),
  is_active boolean not null default true,
  total_billed numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  bill_count int not null default 0,
  last_billed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  description text,
  category text,
  hsn_code text,
  unit text not null default 'piece',
  price numeric(12,2) not null default 0,
  cost_price numeric(12,2),
  tax_rate numeric(5,2) not null default 0,
  stock_qty numeric(12,3),
  low_stock_alert numeric(12,3),
  barcode text,
  sku text,
  track_expiry boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock_qty is null or stock_qty >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  quotation_id uuid,
  invoice_number text not null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_gstin text,
  customer_state_code text,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  taxable_amt numeric(12,2) not null default 0,
  cgst_amt numeric(12,2) not null default 0,
  sgst_amt numeric(12,2) not null default 0,
  igst_amt numeric(12,2) not null default 0,
  round_off_amt numeric(12,2) not null default 0,
  place_of_supply_state_code text,
  is_interstate boolean not null default false,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  payment_mode text,
  paid_at timestamptz,
  include_upi_qr boolean not null default true,
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancel_reason text,
  pdf_path text,
  source text not null default 'app' check (source in ('app', 'offline_sync', 'recurring', 'whatsapp', 'conversion', 'pos')),
  tax_correction_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  batch_id uuid,
  name text not null,
  hsn_code text,
  unit text not null default 'piece',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  making_charge numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  taxable_amt numeric(12,2) not null default 0,
  tax_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  quotation_number text not null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_gstin text,
  customer_state_code text,
  subtotal numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  taxable_amt numeric(12,2) not null default 0,
  cgst_amt numeric(12,2) not null default 0,
  sgst_amt numeric(12,2) not null default 0,
  igst_amt numeric(12,2) not null default 0,
  tax_amt numeric(12,2) not null default 0,
  round_off_amt numeric(12,2) not null default 0,
  place_of_supply_state_code text,
  is_interstate boolean not null default false,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  valid_until date,
  notes text,
  converted_invoice_id uuid references public.invoices(id) on delete restrict,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- invoices.quotation_id FK added after quotations exists.
alter table public.invoices
  add constraint invoices_quotation_fk
  foreign key (quotation_id) references public.quotations(id) on delete restrict;

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  name text not null,
  hsn_code text,
  unit text not null default 'piece',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  making_charge numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  discount_amt numeric(12,2) not null default 0,
  taxable_amt numeric(12,2) not null default 0,
  tax_amt numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  mode text not null default 'cash',
  received_by uuid references auth.users(id) on delete restrict,
  note text,
  source text not null default 'manual' check (source in ('manual', 'bulk', 'invoice_create', 'recurring')),
  created_at timestamptz not null default now()
);

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_id uuid,
  type text not null check (type in ('SALE', 'STOCK_IN', 'STOCK_OUT', 'AUDIT', 'PURCHASE', 'REVERSAL', 'EXPIRY_WRITEOFF')),
  quantity_change numeric(12,3) not null default 0,
  previous_stock numeric(12,3),
  new_stock numeric(12,3),
  reference_id uuid,
  reference_number text,
  notes text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  type text not null,
  entity_type text,
  entity_id uuid,
  summary text,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_role text,
  created_at timestamptz not null default now()
);
