-- 0008: Staff unification (blueprint B.9). staff_members becomes the only
-- staff table. The legacy public.staff table (written by settings.staffAdd
-- with a plaintext PIN) is migrated row by row and then dropped.
--
-- On a fresh database built from 0001 to 0007 the legacy table never
-- exists, so the whole migration block is a guarded no-op.
-- Plaintext PINs are deliberately NOT migrated: PIN login does not exist
-- anywhere in the product, and carrying secrets forward would be worse
-- than dropping them. This is a recorded product decision (B.9).

-- staff_members.email is relaxed to nullable first so legacy rows without
-- an email can land; the partial unique index from 0004 already tolerates
-- NULL emails.
alter table public.staff_members alter column email drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff'
  ) then
    insert into public.staff_members (shop_id, user_id, email, name, phone, role, status)
    select
      s.shop_id,
      s.user_id,
      s.email,
      s.name,
      s.phone,
      case
        when s.role = 'admin' and s.user_id = sh.owner_id then 'owner'
        when s.role = 'admin' then 'manager'
        else 'cashier'
      end,
      case
        when coalesce(s.is_active, true) = false then 'disabled'
        when s.user_id is not null then 'active'
        else 'invited'
      end
    from public.staff s
    join public.shops sh on sh.id = s.shop_id
    on conflict do nothing;

    drop table public.staff;
  end if;
end;
$$;
