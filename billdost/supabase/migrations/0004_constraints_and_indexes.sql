-- 0004: Unique constraints and indexes (blueprint B.3).
-- On the live project, run the data cleanup in blueprint B.7 step 4 BEFORE
-- applying this file: the uniques will fail on duplicated data by design.

create unique index shops_slug_key on public.shops (slug);

-- A cancelled bill keeps its number retired: the partial index is the
-- backstop, next_document_number only ever moves forward.
create unique index invoices_shop_number_key
  on public.invoices (shop_id, invoice_number) where status = 'active';

create unique index quotations_shop_number_key
  on public.quotations (shop_id, quotation_number);

create unique index customers_shop_phone_key
  on public.customers (shop_id, phone) where phone is not null and phone <> '';

create unique index products_shop_barcode_key
  on public.products (shop_id, barcode) where barcode is not null;

create unique index products_shop_sku_key
  on public.products (shop_id, sku) where sku is not null;

create unique index staff_members_shop_email_key
  on public.staff_members (shop_id, lower(email)) where email is not null;

create unique index staff_members_shop_user_key
  on public.staff_members (shop_id, user_id) where user_id is not null;

-- Query pattern indexes from the actual routers.
create index invoices_shop_date_idx on public.invoices (shop_id, invoice_date desc);
create index invoices_shop_created_idx on public.invoices (shop_id, created_at desc);
create index invoices_shop_customer_idx on public.invoices (shop_id, customer_id, invoice_date desc);
create index invoices_shop_due_idx on public.invoices (shop_id, payment_status, balance_due) where balance_due > 0;

create index invoice_items_invoice_idx on public.invoice_items (invoice_id, sort_order);
create index invoice_items_product_idx on public.invoice_items (product_id);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id, sort_order);

create index payments_shop_created_idx on public.payments (shop_id, created_at desc);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_shop_customer_idx on public.payments (shop_id, customer_id, created_at desc);

create index products_shop_active_name_idx on public.products (shop_id, is_active, name);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index customers_name_trgm_idx on public.customers using gin (name gin_trgm_ops);
create index invoices_customer_name_trgm_idx on public.invoices using gin (customer_name gin_trgm_ops);

create index inventory_logs_shop_product_idx on public.inventory_logs (shop_id, product_id, created_at desc);
create index inventory_logs_shop_created_idx on public.inventory_logs (shop_id, created_at desc);
create index activity_log_shop_created_idx on public.activity_log (shop_id, created_at desc);
create index customers_shop_name_idx on public.customers (shop_id, name);
create index staff_members_user_idx on public.staff_members (user_id) where user_id is not null;
