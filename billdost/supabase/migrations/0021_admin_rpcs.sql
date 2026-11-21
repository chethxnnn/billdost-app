-- 0021: Admin portal RPCs (Admin Portal plan, Sections 3, 4 and 5).
--
-- Why RPCs, and why not complete_onboarding_tx: that function
-- (migration 0014) creates a shop for the signed-in caller and makes
-- the caller the owner. A portal-created shop is the opposite shape:
-- the admin creates it, and the owner has no auth account at all until
-- activation. So the portal gets its own transaction,
-- admin_create_shop_tx, which mirrors the 0014 payload conventions but
-- leaves owner_id NULL and status 'pending_activation'.
--
-- Calling convention for every function in this file: EXECUTE is
-- granted to service_role only. The portal and shop app servers first
-- verify the caller's session (an active admin, for the admin
-- functions) and only then call with the service role. The admin
-- functions additionally re-check the admin row inside the database,
-- so a server bug cannot turn a disabled or wrong-role admin into a
-- shop creator.
--
-- Token handling: the servers generate the raw token (32 random
-- bytes) and pass only its SHA-256 hash. The raw token exists in
-- exactly one place after that: the message sent to the shopkeeper.

-- ------------------------------------------------------------ role check
create or replace function app.assert_admin(p_admin_id uuid, p_roles text[])
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text;
  v_status text;
  v_auth uuid;
begin
  select role, status, auth_user_id
  into v_role, v_status, v_auth
  from public.admin_users
  where id = p_admin_id;

  if v_role is null or v_status <> 'active' then
    raise exception 'admin_not_active' using errcode = '28000';
  end if;
  if not (v_role = any (p_roles)) then
    raise exception 'admin_forbidden' using errcode = '42501';
  end if;
  return v_auth;
end;
$$;

revoke execute on function app.assert_admin(uuid, text[]) from public, anon, authenticated;
grant execute on function app.assert_admin(uuid, text[]) to service_role;

-- ------------------------------------------------------- create the shop
-- Payload keys mirror complete_onboarding_tx, plus the owner identity
-- and the optional access request this setup came from:
--   shop_name, category, address, state, state_code, gstin, upi_id,
--   include_upi_qr, language, logo_url, terms_conditions,
--   owner_name, owner_mobile, owner_email (optional real email),
--   products: [{name, price, unit, category}],
--   staff:    [{name, phone, role}],
--   request_id (optional uuid of the access_requests row)
create or replace function public.admin_create_shop_tx(
  p_admin_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin_auth uuid := app.assert_admin(
    p_admin_id, array['founder', 'co_founder', 'support']);
  v_shop_id uuid;
  v_slug text;
  v_mobile text;
  v_digits text;
  v_login_email text;
  v_request_id uuid := nullif(p_payload ->> 'request_id', '')::uuid;
  v_item jsonb;
  v_idx int := 0;
begin
  if coalesce(trim(p_payload ->> 'shop_name'), '') = '' then
    raise exception 'shop_name_required' using errcode = '22023';
  end if;
  if coalesce(trim(p_payload ->> 'owner_mobile'), '') = '' then
    raise exception 'owner_mobile_required' using errcode = '22023';
  end if;

  v_slug := trim(both '-' from
    regexp_replace(lower(p_payload ->> 'shop_name'), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'shop';
  end if;
  v_slug := v_slug || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 6);

  v_mobile := trim(p_payload ->> 'owner_mobile');
  v_digits := regexp_replace(v_mobile, '\D', '', 'g');
  if length(v_digits) > 10 then
    v_digits := right(v_digits, 10);
  end if;
  -- The login identity: the owner's real email when he has one,
  -- otherwise a generated id from his mobile (plan Section 4: many
  -- shopkeepers barely use email; the id only has to be unique and
  -- typeable). The password is set by the owner at activation.
  v_login_email := coalesce(
    nullif(trim(p_payload ->> 'owner_email'), ''),
    v_digits || '@billdost.in'
  );

  insert into public.shops (
    owner_id, name, slug, category, address, phone, email, gstin,
    state, state_code, logo_url, upi_id, include_upi_qr_default,
    language, onboarding_done, status, terms_conditions
  ) values (
    null,
    p_payload ->> 'shop_name',
    v_slug,
    coalesce(nullif(p_payload ->> 'category', ''), 'other'),
    nullif(p_payload ->> 'address', ''),
    v_mobile,
    v_login_email,
    nullif(upper(coalesce(p_payload ->> 'gstin', '')), ''),
    coalesce(p_payload ->> 'state', ''),
    nullif(p_payload ->> 'state_code', ''),
    nullif(p_payload ->> 'logo_url', ''),
    nullif(p_payload ->> 'upi_id', ''),
    coalesce((p_payload ->> 'include_upi_qr')::boolean, true),
    coalesce(nullif(p_payload ->> 'language', ''), 'en'),
    true,
    'pending_activation',
    nullif(p_payload ->> 'terms_conditions', '')
  )
  returning id into v_shop_id;

  -- The owner placeholder row: the only staff table, carrying the
  -- intended owner until activation fills user_id and flips status.
  insert into public.staff_members (shop_id, user_id, email, name, phone, role, status, invited_by)
  values (
    v_shop_id,
    null,
    v_login_email,
    coalesce(nullif(p_payload ->> 'owner_name', ''), p_payload ->> 'shop_name'),
    v_mobile,
    'owner',
    'invited',
    v_admin_auth
  );

  -- Optional first staff list agreed on the setup call (plan Section 4:
  -- after setup, staff are the owner's business; this is setup only).
  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload -> 'staff', '[]'::jsonb))
  loop
    insert into public.staff_members (shop_id, email, name, phone, role, status, invited_by)
    values (
      v_shop_id,
      null,
      v_item ->> 'name',
      v_item ->> 'phone',
      case when v_item ->> 'role' = 'manager' then 'manager' else 'cashier' end,
      'invited',
      v_admin_auth
    );
  end loop;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload -> 'products', '[]'::jsonb))
  loop
    insert into public.products (shop_id, name, price, unit, category, sort_order, is_active)
    values (
      v_shop_id,
      v_item ->> 'name',
      coalesce((v_item ->> 'price')::numeric, 0),
      coalesce(nullif(v_item ->> 'unit', ''), 'piece'),
      nullif(v_item ->> 'category', ''),
      v_idx,
      true
    );
    v_idx := v_idx + 1;
  end loop;

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id, actor_role)
  values (
    v_shop_id,
    'shop_created',
    'shop',
    v_shop_id,
    (p_payload ->> 'shop_name') || ' ka shop BillDost team ne set up kiya.',
    v_admin_auth,
    'admin'
  );

  if v_request_id is not null then
    update public.access_requests
    set status = 'setup_done', converted_shop_id = v_shop_id
    where id = v_request_id
      and status in ('new', 'called', 'approved');
  end if;

  insert into public.admin_audit_log (admin_user_id, action, shop_id, request_id, details)
  values (
    p_admin_id,
    'shop_created',
    v_shop_id,
    v_request_id,
    jsonb_build_object('shop_name', p_payload ->> 'shop_name',
                       'login_email', v_login_email)
  );

  return v_shop_id;
end;
$$;

-- ------------------------------------------------------ issue a link
-- Marks every earlier unused token for the shop as replaced, then
-- inserts the new one with a 72-hour expiry. Returns the token row id.
-- p_token_hash is the SHA-256 of the raw token; the raw token never
-- reaches the database.
create or replace function public.admin_issue_activation_tx(
  p_admin_id uuid,
  p_shop_id uuid,
  p_token_hash text,
  p_send_channel text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_owner_name text;
  v_owner_mobile text;
  v_login_email text;
  v_token_id uuid;
begin
  perform app.assert_admin(p_admin_id, array['founder', 'co_founder', 'support']);

  if p_send_channel not in ('whatsapp', 'manual') then
    raise exception 'bad_send_channel' using errcode = '22023';
  end if;

  select status into v_status from public.shops where id = p_shop_id;
  if v_status is null then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending_activation' then
    raise exception 'shop_not_pending_activation' using errcode = 'P0001';
  end if;

  select name, phone, email
  into v_owner_name, v_owner_mobile, v_login_email
  from public.staff_members
  where shop_id = p_shop_id and role = 'owner'
  order by created_at asc
  limit 1;

  update public.activation_tokens
  set replaced_at = now()
  where shop_id = p_shop_id and used_at is null and replaced_at is null;

  insert into public.activation_tokens (
    shop_id, token_hash, intended_owner_name, intended_owner_mobile,
    intended_login_email, expires_at, send_channel, created_by
  ) values (
    p_shop_id, p_token_hash, v_owner_name, v_owner_mobile,
    v_login_email, now() + interval '72 hours', p_send_channel, p_admin_id
  )
  returning id into v_token_id;

  update public.access_requests
  set status = 'activation_sent'
  where converted_shop_id = p_shop_id and status = 'setup_done';

  insert into public.admin_audit_log (admin_user_id, action, shop_id, details)
  values (
    p_admin_id,
    'activation_issued',
    p_shop_id,
    jsonb_build_object('channel', p_send_channel, 'token_id', v_token_id)
  );

  return v_token_id;
end;
$$;

-- --------------------------------------------------------- look a link up
-- Called by the shop app server (service role) when the activation
-- page loads. Returns one vocabulary of states: valid, expired, used,
-- replaced, suspended, invalid. Presenting a dead token increments
-- failed_attempts on its row; an unknown hash has no row to count on,
-- by design.
create or replace function public.activation_lookup(p_token_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.activation_tokens%rowtype;
  v_shop public.shops%rowtype;
  v_state text;
begin
  select * into v_token
  from public.activation_tokens
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_shop from public.shops where id = v_token.shop_id;

  if v_token.used_at is not null or v_shop.status = 'live' then
    v_state := 'used';
  elsif v_token.replaced_at is not null then
    v_state := 'replaced';
  elsif v_token.expires_at <= now() then
    v_state := 'expired';
  elsif v_shop.status = 'suspended' then
    v_state := 'suspended';
  else
    v_state := 'valid';
  end if;

  if v_state in ('used', 'replaced', 'expired') then
    update public.activation_tokens
    set failed_attempts = failed_attempts + 1
    where id = v_token.id;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'shop_id', v_shop.id,
    'shop_name', v_shop.name,
    'owner_name', v_token.intended_owner_name,
    'login_email', v_token.intended_login_email,
    'expires_at', v_token.expires_at
  );
end;
$$;

-- ------------------------------------------------------------ burn a link
-- Called by the shop app server right after it creates the owner's
-- auth account (Supabase Admin API). Links the account as the shop
-- owner, flips the shop live, activates the owner staff row, burns
-- the token, moves the request to live, and writes both logs.
create or replace function public.activation_consume_tx(
  p_token_hash text,
  p_auth_user_id uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.activation_tokens%rowtype;
  v_shop public.shops%rowtype;
  v_email text;
begin
  select * into v_token
  from public.activation_tokens
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

  select * into v_shop from public.shops where id = v_token.shop_id for update;
  if v_shop.status <> 'pending_activation' then
    raise exception 'shop_not_pending_activation' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = p_auth_user_id;
  if v_email is null then
    raise exception 'auth_user_missing' using errcode = 'P0002';
  end if;

  update public.shops
  set owner_id = p_auth_user_id, status = 'live', activated_at = now()
  where id = v_shop.id;

  update public.staff_members
  set user_id = p_auth_user_id, status = 'active', email = v_email
  where shop_id = v_shop.id and role = 'owner' and user_id is null;

  if not found then
    insert into public.staff_members (shop_id, user_id, email, name, phone, role, status)
    values (v_shop.id, p_auth_user_id, v_email,
            v_token.intended_owner_name, v_token.intended_owner_mobile,
            'owner', 'active');
  end if;

  update public.activation_tokens
  set used_at = now()
  where id = v_token.id;

  update public.access_requests
  set status = 'live'
  where converted_shop_id = v_shop.id
    and status in ('setup_done', 'activation_sent');

  insert into public.activity_log (shop_id, type, entity_type, entity_id, summary, actor_user_id, actor_role)
  values (
    v_shop.id,
    'shop_activated',
    'shop',
    v_shop.id,
    v_shop.name || ' ab live hai. Owner ne activation link se password set kiya.',
    p_auth_user_id,
    'owner'
  );

  insert into public.admin_audit_log (admin_user_id, action, shop_id, details)
  values (
    null,
    'shop_activated',
    v_shop.id,
    jsonb_build_object('via', 'activation_link', 'token_id', v_token.id)
  );

  return v_shop.id;
end;
$$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.admin_create_shop_tx(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_shop_tx(uuid, jsonb)
  to service_role;
revoke execute on function public.admin_issue_activation_tx(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_issue_activation_tx(uuid, uuid, text, text)
  to service_role;
revoke execute on function public.activation_lookup(text)
  from public, anon, authenticated;
grant execute on function public.activation_lookup(text)
  to service_role;
revoke execute on function public.activation_consume_tx(text, uuid)
  from public, anon, authenticated;
grant execute on function public.activation_consume_tx(text, uuid)
  to service_role;
