-- 0005: RLS policies, GRANTs, storage buckets (blueprint B.4, B.5, B.8).
-- Every shop-data table gets RLS with policies keyed to shop membership.
-- There are no anon grants on shop data: the app has no unauthenticated
-- data reads, and the public store page (Phase 3) will read through a
-- dedicated security definer RPC, not table grants.
--
-- NOTE on write paths: the blueprint's end state is RPC-only writes for
-- invoices, invoice_items, payments and inventory_logs. Stage 1 of the
-- build keeps the existing routers writing through PostgREST, so those
-- tables keep member-scoped INSERT policies here. The tightening to
-- RPC-only writes lands as a follow-on migration when the routers switch
-- to the RPCs in 0006 (Stage 2). RLS still enforces shop membership on
-- every read and write in the meantime.

-- ---------------------------------------------------------------- shops
alter table public.shops enable row level security;

create policy shops_select_member on public.shops for select to authenticated
  using (id in (select app.current_shop_ids()));
create policy shops_insert_owner on public.shops for insert to authenticated
  with check (owner_id = auth.uid());
create policy shops_update_owner on public.shops for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No delete policy: shops are soft-deleted via deleted_at.

grant select, insert, update, delete on public.shops to authenticated;
grant all on public.shops to service_role;

-- --------------------------------------------------------- staff_members
alter table public.staff_members enable row level security;

create policy staff_members_select_member on public.staff_members for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy staff_members_insert_owner on public.staff_members for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner']));
create policy staff_members_update_owner on public.staff_members for update to authenticated
  using (app.is_shop_member(shop_id, array['owner']))
  with check (app.is_shop_member(shop_id, array['owner']));
create policy staff_members_delete_owner on public.staff_members for delete to authenticated
  using (app.is_shop_member(shop_id, array['owner']));

grant select, insert, update, delete on public.staff_members to authenticated;
grant all on public.staff_members to service_role;

-- ------------------------------------------------------------- customers
alter table public.customers enable row level security;

create policy customers_select_member on public.customers for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy customers_insert_member on public.customers for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));
create policy customers_update_member on public.customers for update to authenticated
  using (shop_id in (select app.current_shop_ids()))
  with check (shop_id in (select app.current_shop_ids()));
-- No delete policy: customers are soft-deleted via is_active (manager/owner
-- is enforced in the router and, for stats columns, by the RPC design).

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;

-- -------------------------------------------------------------- products
alter table public.products enable row level security;

create policy products_select_member on public.products for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy products_insert_manager on public.products for insert to authenticated
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy products_update_manager on public.products for update to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']))
  with check (app.is_shop_member(shop_id, array['owner', 'manager']));
create policy products_delete_manager on public.products for delete to authenticated
  using (app.is_shop_member(shop_id, array['owner', 'manager']));

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

-- -------------------------------------------------------------- invoices
alter table public.invoices enable row level security;

create policy invoices_select_member on public.invoices for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy invoices_insert_member on public.invoices for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));
-- No direct update or delete policies: changes go through guarded server
-- procedures and, from Stage 2, the RPCs in 0006.

grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

-- ---------------------------------------------------------- invoice_items
alter table public.invoice_items enable row level security;

create policy invoice_items_select_member on public.invoice_items for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.shop_id in (select app.current_shop_ids())
  ));
create policy invoice_items_insert_member on public.invoice_items for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.shop_id in (select app.current_shop_ids())
  ));

grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;

-- ------------------------------------------------------------ quotations
alter table public.quotations enable row level security;

create policy quotations_select_member on public.quotations for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy quotations_insert_member on public.quotations for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));
create policy quotations_update_member on public.quotations for update to authenticated
  using (shop_id in (select app.current_shop_ids()))
  with check (shop_id in (select app.current_shop_ids()));

grant select, insert, update, delete on public.quotations to authenticated;
grant all on public.quotations to service_role;

-- -------------------------------------------------------- quotation_items
alter table public.quotation_items enable row level security;

create policy quotation_items_select_member on public.quotation_items for select to authenticated
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.shop_id in (select app.current_shop_ids())
  ));
create policy quotation_items_insert_member on public.quotation_items for insert to authenticated
  with check (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.shop_id in (select app.current_shop_ids())
  ));

grant select, insert, update, delete on public.quotation_items to authenticated;
grant all on public.quotation_items to service_role;

-- -------------------------------------------------------------- payments
alter table public.payments enable row level security;

create policy payments_select_member on public.payments for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy payments_insert_member on public.payments for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;

-- --------------------------------------------------------- inventory_logs
alter table public.inventory_logs enable row level security;

create policy inventory_logs_select_member on public.inventory_logs for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy inventory_logs_insert_member on public.inventory_logs for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

grant select, insert, update, delete on public.inventory_logs to authenticated;
grant all on public.inventory_logs to service_role;

-- ------------------------------------------------------------ activity_log
alter table public.activity_log enable row level security;

create policy activity_log_select_member on public.activity_log for select to authenticated
  using (shop_id in (select app.current_shop_ids()));
create policy activity_log_insert_member on public.activity_log for insert to authenticated
  with check (shop_id in (select app.current_shop_ids()));

grant select, insert, update, delete on public.activity_log to authenticated;
grant all on public.activity_log to service_role;

-- ------------------------------------------------------------- storage
-- Buckets are created in SQL so they exist on every environment.
insert into storage.buckets (id, name, public) values
  ('logos', 'logos', true),
  ('qr-codes', 'qr-codes', false),
  ('invoice-pdfs', 'invoice-pdfs', false),
  ('imports', 'imports', false)
on conflict (id) do update set public = excluded.public;

-- logos: a logo printed on bills is not secret. Public read; writes only
-- into the owner's own shop folder (first path segment is the shop id).
create policy logos_public_read on storage.objects for select to public
  using (bucket_id = 'logos');
create policy logos_shop_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
create policy logos_shop_update on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );

-- qr-codes: PRIVATE (a public UPI QR URL leaks the shop UPI id). Members
-- of the shop only.
create policy qr_codes_shop_read on storage.objects for select to authenticated
  using (
    bucket_id = 'qr-codes'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
create policy qr_codes_shop_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'qr-codes'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
create policy qr_codes_shop_update on storage.objects for update to authenticated
  using (
    bucket_id = 'qr-codes'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );

-- invoice-pdfs: private, members read and write their own shop folder.
create policy invoice_pdfs_shop_read on storage.objects for select to authenticated
  using (
    bucket_id = 'invoice-pdfs'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
create policy invoice_pdfs_shop_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoice-pdfs'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );

-- imports: private, members write and read their own shop folder.
create policy imports_shop_read on storage.objects for select to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
create policy imports_shop_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] in (select c::text from app.current_shop_ids() c)
  );
