-- seed.sql: LOCAL DEVELOPMENT ONLY.
-- Creates one demo shop (Karnataka) with an owner, a manager, a cashier,
-- 10 products and 3 customers so `supabase db reset` gives a working app.
-- Never run this against the live project: it inserts a known-password
-- auth user.

-- Demo login: owner@demo.billdost.local / demo-password-123
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner@demo.billdost.local',
  crypt('demo-password-123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Demo Owner"}'::jsonb
) on conflict (id) do nothing;

insert into public.shops (
  id, owner_id, name, slug, category, address, phone, email, gstin,
  state, state_code, is_gst_registered, onboarding_done,
  invoice_counter, quotation_counter
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Demo Kirana Store', 'demo-kirana-store', 'grocery',
  'MG Road, Bengaluru', '9876543210', 'owner@demo.billdost.local',
  '29ABCDE1234F1Z5', 'Karnataka', '29', true, true, 1000, 100
) on conflict (id) do nothing;

insert into public.staff_members (shop_id, user_id, email, name, role, status) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'owner@demo.billdost.local', 'Demo Owner', 'owner', 'active'),
  ('22222222-2222-2222-2222-222222222222',
   null, 'manager@demo.billdost.local', 'Demo Manager', 'manager', 'invited'),
  ('22222222-2222-2222-2222-222222222222',
   null, 'cashier@demo.billdost.local', 'Demo Cashier', 'cashier', 'invited')
on conflict do nothing;

insert into public.products (shop_id, name, hsn_code, unit, price, tax_rate, stock_qty) values
  ('22222222-2222-2222-2222-222222222222', 'Basmati Rice 5kg', '1006', 'piece', 649, 5, 40),
  ('22222222-2222-2222-2222-222222222222', 'Toor Dal 1kg', '0713', 'piece', 165, 5, 120),
  ('22222222-2222-2222-2222-222222222222', 'Sunflower Oil 1L', '1512', 'piece', 145, 5, 80),
  ('22222222-2222-2222-2222-222222222222', 'Atta 10kg', '1101', 'piece', 425, 5, 25),
  ('22222222-2222-2222-2222-222222222222', 'Sugar 1kg', '1701', 'piece', 45, 5, 200),
  ('22222222-2222-2222-2222-222222222222', 'Detergent Powder 1kg', '3402', 'piece', 118, 18, 60),
  ('22222222-2222-2222-2222-222222222222', 'Bath Soap 4 pack', '3401', 'piece', 132, 18, 90),
  ('22222222-2222-2222-2222-222222222222', 'Tea Powder 500g', '0902', 'piece', 260, 5, 45),
  ('22222222-2222-2222-2222-222222222222', 'Instant Noodles 12 pack', '1902', 'piece', 168, 12, 70),
  ('22222222-2222-2222-2222-222222222222', 'LED Bulb 9W', '8539', 'piece', 99, 18, 150)
on conflict do nothing;

insert into public.customers (shop_id, name, phone, address, state, state_code) values
  ('22222222-2222-2222-2222-222222222222', 'Ramesh Gupta', '9812345670', 'Koramangala, Bengaluru', 'Karnataka', '29'),
  ('22222222-2222-2222-2222-222222222222', 'Priya Traders', '9822345671', 'Andheri West, Mumbai', 'Maharashtra', '27'),
  ('22222222-2222-2222-2222-222222222222', 'Walk-in Sharma', '9833345672', null, 'Karnataka', '29')
on conflict do nothing;
