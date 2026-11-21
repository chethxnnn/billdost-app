-- 0014: Onboarding completes through one server transaction (blueprint C13).
--
-- Before this migration the onboarding wizard wrote shops, staff_members,
-- products and activity_log as four separate browser-to-PostgREST inserts.
-- A failure halfway left a shop with no owner row (or an owner with no
-- products), and one insert was already silently broken: the wizard
-- collects staff by phone only, but staff_members.email was NOT NULL, so
-- the invited-staff insert failed on every run and its error was never
-- checked.
--
-- 1. staff_members.email becomes nullable. Phone-only onboarding invites
--    store NULL; the partial unique index (shop_id, lower(email)) already
--    ignores NULLs, and accept_staff_invite only matches real emails, so
--    activation stays the Stage 2 email invite flow from Settings.
alter table public.staff_members alter column email drop not null;

-- 2. complete_onboarding_tx: shop + owner row + invited staff + starter
--    products + activity log in ONE transaction, as the signed-in user.
create or replace function public.complete_onboarding_tx(p_payload jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := '';
  v_name text := '';
  v_phone text := '';
  v_shop_id uuid;
  v_item jsonb;
  v_idx int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- One shop per owner in Phase 0 (unique index shops_owner_unique_phase0).
  -- A second call is a conflict, not a second shop and not a half-write.
  if exists (
    select 1 from public.shops where owner_id = v_uid and deleted_at is null
  ) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  select coalesce(u.email, ''),
         coalesce(u.raw_user_meta_data ->> 'full_name', ''),
         coalesce(u.raw_user_meta_data ->> 'phone', '')
  into v_email, v_name, v_phone
  from auth.users u
  where u.id = v_uid;

  insert into public.shops (
    owner_id, name, slug, category, logo_url, phone, email, gstin,
    upi_id, upi_qr_url, include_upi_qr_default, language, onboarding_done
  ) values (
    v_uid,
    p_payload ->> 'shop_name',
    p_payload ->> 'slug',
    coalesce(nullif(p_payload ->> 'category', ''), 'other'),
    nullif(p_payload ->> 'logo_url', ''),
    v_phone,
    v_email,
    nullif(upper(coalesce(p_payload ->> 'gstin', '')), ''),
    nullif(p_payload ->> 'upi_id', ''),
    nullif(p_payload ->> 'upi_qr_url', ''),
    coalesce((p_payload ->> 'include_upi_qr')::boolean, true),
    coalesce(nullif(p_payload ->> 'language', ''), 'en'),
    true
  )
  returning id into v_shop_id;

  -- The owner row: the only staff table since 0008. PINs are deliberately
  -- not stored anywhere (blueprint B.9); the wizard's PIN field is a
  -- local comfort blanket and never reaches the server.
  insert into public.staff_members (shop_id, user_id, email, name, phone, role, status)
  values (
    v_shop_id,
    v_uid,
    v_email,
    coalesce(nullif(v_name, ''), p_payload ->> 'shop_name'),
    v_phone,
    'owner',
    'active'
  );

  -- Invited staff from the wizard (phone only, email NULL: see header).
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
      v_uid
    );
  end loop;

  -- Starter products, in the order the wizard collected them.
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
    (p_payload ->> 'shop_name') || ' ka BillDost account ban gaya! 🎉',
    v_uid,
    'owner'
  );

  return v_shop_id;
end;
$$;

grant execute on function public.complete_onboarding_tx(jsonb) to authenticated;
revoke execute on function public.complete_onboarding_tx(jsonb) from anon, public;
grant execute on function public.complete_onboarding_tx(jsonb) to service_role;
