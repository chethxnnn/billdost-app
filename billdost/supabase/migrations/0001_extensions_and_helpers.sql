-- 0001: Extensions, private helper schema, GST state lookup, shared functions.
-- Target: Supabase Postgres. The auth schema (auth.users, auth.uid()) is
-- provided by Supabase and is referenced, never created here.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists app;

-- GST state code lookup (used for place-of-supply backfills, blueprint B.7).
create table if not exists app.gst_state_codes (
  code text primary key,
  name text not null
);

insert into app.gst_state_codes (code, name) values
  ('01', 'Jammu and Kashmir'), ('02', 'Himachal Pradesh'), ('03', 'Punjab'),
  ('04', 'Chandigarh'), ('05', 'Uttarakhand'), ('06', 'Haryana'),
  ('07', 'Delhi'), ('08', 'Rajasthan'), ('09', 'Uttar Pradesh'),
  ('10', 'Bihar'), ('11', 'Sikkim'), ('12', 'Arunachal Pradesh'),
  ('13', 'Nagaland'), ('14', 'Manipur'), ('15', 'Mizoram'),
  ('16', 'Tripura'), ('17', 'Meghalaya'), ('18', 'Assam'),
  ('19', 'West Bengal'), ('20', 'Jharkhand'), ('21', 'Odisha'),
  ('22', 'Chhattisgarh'), ('23', 'Madhya Pradesh'), ('24', 'Gujarat'),
  ('25', 'Daman and Diu'), ('26', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('27', 'Maharashtra'), ('29', 'Karnataka'), ('30', 'Goa'),
  ('31', 'Lakshadweep'), ('32', 'Kerala'), ('33', 'Tamil Nadu'),
  ('34', 'Puducherry'), ('35', 'Andaman and Nicobar Islands'),
  ('36', 'Telangana'), ('37', 'Andhra Pradesh'), ('38', 'Ladakh'),
  ('97', 'Other Territory')
on conflict (code) do nothing;

-- Helper functions are plpgsql so their bodies are not table-validated at
-- creation time: they reference shops and staff_members, which are created
-- in 0002. All are security definer with a pinned search_path.

create or replace function app.current_shop_ids()
returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
    select id from public.shops where owner_id = auth.uid()
    union
    select shop_id from public.staff_members
    where user_id = auth.uid() and status = 'active';
end;
$$;

create or replace function app.shop_role(p_shop_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text;
begin
  select 'owner' into v_role
  from public.shops
  where id = p_shop_id and owner_id = auth.uid();

  if v_role is not null then
    return v_role;
  end if;

  select role into v_role
  from public.staff_members
  where shop_id = p_shop_id and user_id = auth.uid() and status = 'active'
  limit 1;

  return v_role;
end;
$$;

create or replace function app.is_shop_member(p_shop_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.shop_role(p_shop_id) = any (p_roles)
$$;

-- Shared updated_at maintenance (triggers are attached in 0007).
create or replace function app.set_updated_at()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
