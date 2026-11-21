-- stubs.sql: Supabase platform stubs for the local PG harness.
-- Applied by run-pg-harness.mjs BEFORE any migration, on a fresh
-- PGlite database. It recreates only the platform surface the
-- migrations reference: the anon, authenticated and service_role
-- roles, the auth schema (users table plus uid and jwt helpers), and
-- the storage schema (buckets, objects, foldername). Nothing here is
-- part of the product schema and none of it ships to Supabase.
--
-- Test identity control: auth.uid() reads the session setting
-- test.uid and auth.jwt() builds its email claim from test.email.
-- Assertions set them with select set_config('test.uid', '<uuid>',
-- false) and clear them with an empty string.

do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------ auth
create schema if not exists auth;

-- Column set matches seed.sql, which inserts a full Supabase style
-- user row (instance_id, aud, encrypted_password, meta data, ...).
create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb
);

create or replace function auth.uid()
returns uuid
language plpgsql stable
as $$
declare
  v text := current_setting('test.uid', true);
begin
  if v is null or v = '' then
    return null;
  end if;
  return v::uuid;
end;
$$;

create or replace function auth.jwt()
returns jsonb
language plpgsql stable
as $$
declare
  v text := current_setting('test.email', true);
begin
  if v is null or v = '' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('email', v);
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- --------------------------------------------------------------- storage
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean
);

create table if not exists storage.objects (
  id uuid default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);

alter table storage.objects enable row level security;

-- Path segments except the last one (the file name), mirroring the
-- Supabase storage helper the 0005 policies call.
create or replace function storage.foldername(p_name text)
returns text[]
language sql immutable
as $$
  select case
    when array_length(string_to_array(p_name, '/'), 1) is null
      then '{}'::text[]
    when array_length(string_to_array(p_name, '/'), 1) <= 1
      then '{}'::text[]
    else (string_to_array(p_name, '/'))[1:array_length(string_to_array(p_name, '/'), 1) - 1]
  end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
