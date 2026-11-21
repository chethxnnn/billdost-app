-- 0022: Team tracking, presence, theme, and the founder approval
-- gate (final portal build, Nov 22). One migration, four moves:
--
-- 1. Presence and personal theme on admin_users: last_active_at is
--    written by a throttled heartbeat from the portal shell and by
--    every audited action; ui_theme is the admin's own manual
--    Light/Dark choice (never automatic, never following the OS).
--
-- 2. Assignments and work state: access_requests and client_errors
--    gain an assignee (FK to admin_users), a claimed_at stamp and a
--    started_at stamp (set by the Start action, cleared when the
--    status advances). Shops gain a support owner. "Who is doing
--    what, right now" is answered from these columns, not guessed.
--
-- 3. call_logs: every call the team makes about a shop or a request,
--    one row, one outcome. Feeds team stats and the activity
--    timeline. Outcome is a closed vocabulary.
--
-- 4. The founder approval gate. shops.status gains two values:
--    awaiting_approval (a teammate prepared the setup; no activation
--    link may exist yet) and setup_returned (the founder sent it
--    back with a note). admin_create_shop_tx is replaced: a shop
--    created by support lands in awaiting_approval; a shop created
--    by the founder or a co-founder is approved inline and lands in
--    pending_activation, with the approval itself audit-logged.
--    admin_issue_activation_tx is replaced too: only founder and
--    co-founder may issue links, and it already refuses any shop
--    whose status is not pending_activation, so an awaiting_approval
--    shop can never receive a token.
--
-- Access rules match 0017-0021: RLS on, no grants for anon or
-- authenticated, service role only. The portal server checks the
-- session and role before every read and write.

-- ------------------------------------------------------------ 1. admin_users
alter table public.admin_users
  add column ui_theme text not null default 'light'
    check (ui_theme in ('light', 'dark'));
alter table public.admin_users
  add column last_active_at timestamptz;

-- ------------------------------------------------- 2. assignments + work state
alter table public.access_requests
  add column assignee_id uuid references public.admin_users(id) on delete set null;
alter table public.access_requests
  add column claimed_at timestamptz;
alter table public.access_requests
  add column started_at timestamptz;

alter table public.client_errors
  add column assignee_id uuid references public.admin_users(id) on delete set null;
alter table public.client_errors
  add column claimed_at timestamptz;
alter table public.client_errors
  add column started_at timestamptz;

alter table public.shops
  add column support_owner_id uuid references public.admin_users(id) on delete set null;

create index access_requests_assignee_idx
  on public.access_requests (assignee_id) where assignee_id is not null;
create index client_errors_assignee_idx
  on public.client_errors (assignee_id) where assignee_id is not null;
create index shops_support_owner_idx
  on public.shops (support_owner_id) where support_owner_id is not null;

-- ------------------------------------------------------------ 3. call logs
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_users(id) on delete restrict,
  shop_id uuid references public.shops(id) on delete set null,
  request_id uuid references public.access_requests(id) on delete set null,
  outcome text not null
    check (outcome in ('answered', 'no_answer', 'busy',
                       'callback_requested', 'not_interested',
                       'converted', 'other')),
  note text,
  created_at timestamptz not null default now()
);

create index call_logs_admin_created_idx
  on public.call_logs (admin_id, created_at desc);
create index call_logs_shop_created_idx
  on public.call_logs (shop_id, created_at desc) where shop_id is not null;
create index call_logs_request_created_idx
  on public.call_logs (request_id, created_at desc) where request_id is not null;

alter table public.call_logs enable row level security;

revoke all on public.call_logs from anon, authenticated;
grant all on public.call_logs to service_role;

-- ------------------------------------------- 4. the founder approval gate
alter table public.shops drop constraint if exists shops_status_check;
alter table public.shops
  add constraint shops_status_check
    check (status in ('awaiting_approval', 'setup_returned',
                      'pending_activation', 'live', 'suspended'));

alter table public.shops
  add column setup_review_note text;
alter table public.shops
  add column setup_reviewed_by uuid references public.admin_users(id) on delete set null;
alter table public.shops
  add column setup_reviewed_at timestamptz;

-- admin_create_shop_tx, replaced: the landing status now depends on
-- who created the shop. Founder and co-founder creations are approved
-- inline (and the approval is written to the audit log, so the trail
-- is identical); support creations wait for the founder's decision
-- in awaiting_approval. Everything else is unchanged from 0021.
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
  v_role text;
  v_shop_id uuid;
  v_slug text;
  v_mobile text;
  v_digits text;
  v_login_email text;
  v_status text;
  v_request_id uuid := nullif(p_payload ->> 'request_id', '')::uuid;
  v_item jsonb;
  v_idx int := 0;
begin
  select role into v_role from public.admin_users where id = p_admin_id;

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
  v_login_email := coalesce(
    nullif(trim(p_payload ->> 'owner_email'), ''),
    v_digits || '@billdost.in'
  );

  v_status := case
    when v_role in ('founder', 'co_founder') then 'pending_activation'
    else 'awaiting_approval'
  end;

  insert into public.shops (
    owner_id, name, slug, category, address, phone, email, gstin,
    state, state_code, logo_url, upi_id, include_upi_qr_default,
    language, onboarding_done, status, terms_conditions,
    support_owner_id
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
    v_status,
    nullif(p_payload ->> 'terms_conditions', ''),
    p_admin_id
  )
  returning id into v_shop_id;

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
                       'login_email', v_login_email,
                       'initial_status', v_status)
  );

  if v_status = 'pending_activation' then
    insert into public.admin_audit_log (admin_user_id, action, shop_id, request_id, details)
    values (
      p_admin_id,
      'shop_approved',
      v_shop_id,
      v_request_id,
      jsonb_build_object('shop_name', p_payload ->> 'shop_name',
                         'inline', true)
    );
  end if;

  return v_shop_id;
end;
$$;

-- admin_issue_activation_tx, replaced: founder and co-founder only.
-- The status check below is the second lock: a shop in
-- awaiting_approval (or setup_returned, live, suspended) can never
-- receive a token, whoever asks.
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
  perform app.assert_admin(p_admin_id, array['founder', 'co_founder']);

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

revoke execute on function public.admin_create_shop_tx(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_shop_tx(uuid, jsonb)
  to service_role;
revoke execute on function public.admin_issue_activation_tx(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_issue_activation_tx(uuid, uuid, text, text)
  to service_role;
