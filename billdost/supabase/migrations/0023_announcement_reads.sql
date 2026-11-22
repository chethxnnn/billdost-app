-- 0023: Announcements reach the shop app (fix round, Stage 2).
--
-- Migration 0020 created public.announcements for the admin portal
-- and granted it to the service role only, so the shop app could
-- never read a single announcement: the portal wrote into a void.
-- This migration adds the receiving half:
--
-- 1. A read policy on announcements for authenticated shop members.
--    A shop sees an announcement when it is inside its window and
--    targeted at everyone, at the shop's category, or at the shop
--    itself. Targeting is evaluated against app.current_shop_ids(),
--    the same membership helper every other shop table uses.
-- 2. public.announcement_reads: per-shop seen state, so a banner can
--    be dismissed once and the bell badge can count what is unseen.
--    Seen is per shop, not per user: when anyone in the shop has
--    seen an announcement, the shop has seen it.
--
-- Grants ride in this file, per the post-30-Oct-2026 Data API rule.

-- ------------------------------------------------------------ reads table
create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (announcement_id, shop_id)
);

create index announcement_reads_shop_idx
  on public.announcement_reads (shop_id, seen_at desc);

alter table public.announcement_reads enable row level security;

create policy announcement_reads_select_member on public.announcement_reads
  for select to authenticated
  using (shop_id in (select app.current_shop_ids()));

create policy announcement_reads_insert_member on public.announcement_reads
  for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

-- ------------------------------------------------- announcement visibility
create policy announcements_select_targeted on public.announcements
  for select to authenticated
  using (
    starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      audience = 'all'
      or (
        audience = 'shop'
        and shop_id in (select app.current_shop_ids())
      )
      or (
        audience = 'category'
        and exists (
          select 1 from public.shops s
          where s.id in (select app.current_shop_ids())
            and s.category = announcements.category
        )
      )
    )
  );

-- ------------------------------------------------------------------ grants
revoke all on public.announcements from anon;
grant select on public.announcements to authenticated;
grant all on public.announcements to service_role;

revoke all on public.announcement_reads from anon, authenticated;
grant select, insert on public.announcement_reads to authenticated;
grant all on public.announcement_reads to service_role;
