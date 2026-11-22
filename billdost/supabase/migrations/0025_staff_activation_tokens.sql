-- 0025: Staff activation links (fix round, Stage 4).
--
-- The old staff invite leaned on Supabase's invite email, which
-- landed the invitee on a generic sign-in page with no context: no
-- shop name, no role, no password step. This migration gives staff
-- the same door the shop owner got (0019/0021): a one-time link the
-- owner sends over WhatsApp or copies, opening a join page that
-- names the shop and the role and lets the invitee set their own
-- password.
--
-- staff_activation_tokens mirrors activation_tokens: only the
-- SHA-256 hash of the raw token is stored, a link lives 72 hours,
-- works once, and dies the moment a newer link is issued for the
-- same staff row. The table is service-role only; the shop app
-- server routes and the issue RPC below are the only doors.
--
-- RPC vocabulary mirrors the shop activation one: lookup states
-- valid, expired, used, replaced, invalid; consume raises
-- token_invalid, token_used, token_replaced, token_expired.

-- ------------------------------------------------------------------ table
create table public.staff_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  replaced_at timestamptz,
  failed_attempts int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index staff_activation_tokens_staff_created_idx
  on public.staff_activation_tokens (staff_member_id, created_at desc);

-- At most one live link per staff member, enforced by the database.
create unique index staff_activation_tokens_one_live_per_staff
  on public.staff_activation_tokens (staff_member_id)
  where used_at is null and replaced_at is null;

alter table public.staff_activation_tokens enable row level security;
-- No policies: anon and authenticated have no direct access at all.
revoke all on public.staff_activation_tokens from anon, authenticated;
grant all on public.staff_activation_tokens to service_role;

-- ------------------------------------------------------------ issue a link
-- Called by the shop app (tRPC staff router) as the signed-in owner.
-- The caller must be the shop's owner; the staff row must belong to
-- that shop and still be waiting for its invite to be accepted.
create or replace function public.staff_invite_issue_tx(
  p_staff_member_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_staff public.staff_members%rowtype;
  v_token_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_staff from public.staff_members where id = p_staff_member_id;
  if not found then
    raise exception 'staff_not_found' using errcode = 'P0002';
  end if;

  perform app.assert_shop_role(v_staff.shop_id, v_uid, array['owner']);
  if v_staff.role = 'owner' then
    raise exception 'cannot_invite_owner' using errcode = '22023';
  end if;
  if v_staff.status <> 'invited' then
    raise exception 'staff_not_invited' using errcode = 'P0001';
  end if;

  update public.staff_activation_tokens
  set replaced_at = now()
  where staff_member_id = p_staff_member_id
    and used_at is null and replaced_at is null;

  insert into public.staff_activation_tokens (
    staff_member_id, shop_id, token_hash, expires_at, created_by
  ) values (
    p_staff_member_id, v_staff.shop_id, p_token_hash,
    now() + interval '72 hours', v_uid
  )
  returning id into v_token_id;

  return v_token_id;
end;
$$;

revoke execute on function public.staff_invite_issue_tx(uuid, text)
  from public, anon;
grant execute on function public.staff_invite_issue_tx(uuid, text)
  to authenticated, service_role;

-- --------------------------------------------------------- look a link up
-- Called by the shop app server (service role) when the join page
-- loads. account_exists tells the page to offer the sign-in path
-- instead of the password form: the invitee already has a BillDost
-- account under the invited email, so accept_staff_invite (which
-- matches by email) is their door.
create or replace function public.staff_invite_lookup(p_token_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.staff_activation_tokens%rowtype;
  v_staff public.staff_members%rowtype;
  v_shop public.shops%rowtype;
  v_state text;
  v_account_exists boolean := false;
begin
  select * into v_token
  from public.staff_activation_tokens
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_staff from public.staff_members where id = v_token.staff_member_id;
  select * into v_shop from public.shops where id = v_token.shop_id;

  if v_token.used_at is not null or v_staff.status = 'active' then
    v_state := 'used';
  elsif v_token.replaced_at is not null then
    v_state := 'replaced';
  elsif v_token.expires_at <= now() then
    v_state := 'expired';
  elsif v_staff.status <> 'invited' then
    v_state := 'used';
  else
    v_state := 'valid';
  end if;

  if v_state in ('used', 'replaced', 'expired') then
    update public.staff_activation_tokens
    set failed_attempts = failed_attempts + 1
    where id = v_token.id;
  end if;

  if v_state = 'valid' and v_staff.email is not null then
    select exists (
      select 1 from auth.users u where lower(u.email) = lower(v_staff.email)
    ) into v_account_exists;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'shop_id', v_shop.id,
    'shop_name', v_shop.name,
    'staff_name', v_staff.name,
    'role', v_staff.role,
    'email', v_staff.email,
    'has_email', v_staff.email is not null,
    'account_exists', v_account_exists,
    'expires_at', v_token.expires_at
  );
end;
$$;

revoke execute on function public.staff_invite_lookup(text)
  from public, anon, authenticated;
grant execute on function public.staff_invite_lookup(text)
  to service_role;

-- ------------------------------------------------------------ burn a link
-- Called by the shop app server right after it creates the invitee's
-- auth account (Supabase Admin API) with the password they typed.
-- Links the account to the staff row, activates it, burns the token
-- and writes the activity log line.
create or replace function public.staff_invite_consume_tx(
  p_token_hash text,
  p_auth_user_id uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.staff_activation_tokens%rowtype;
  v_staff public.staff_members%rowtype;
  v_email text;
begin
  select * into v_token
  from public.staff_activation_tokens
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'token_invalid' using errcode = 'P0002';
  end if;
  if v_token.used_at is not null then
    raise exception 'token_used' using errcode = 'P0001';
  end if;
  if v_token.replaced_at is not null then
    raise exception 'token_replaced' using errcode = 'P0001';
  end if;
  if v_token.expires_at <= now() then
    raise exception 'token_expired' using errcode = 'P0001';
  end if;

  select * into v_staff from public.staff_members
  where id = v_token.staff_member_id for update;
  if v_staff.status <> 'invited' then
    raise exception 'token_used' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = p_auth_user_id;
  if v_email is null then
    raise exception 'auth_user_missing' using errcode = 'P0002';
  end if;

  update public.staff_members
  set user_id = p_auth_user_id,
      status = 'active',
      email = coalesce(email, v_email),
      last_seen_at = now()
  where id = v_staff.id;

  update public.staff_activation_tokens
  set used_at = now()
  where id = v_token.id;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id, actor_role)
  values (
    v_staff.shop_id,
    'staff_joined',
    'staff',
    v_staff.id,
    coalesce(v_staff.name, v_email) || ' team mein shamil ho gaye (' || v_staff.role || ').',
    p_auth_user_id,
    v_staff.role
  );

  return v_staff.shop_id;
end;
$$;

revoke execute on function public.staff_invite_consume_tx(text, uuid)
  from public, anon, authenticated;
grant execute on function public.staff_invite_consume_tx(text, uuid)
  to service_role;
