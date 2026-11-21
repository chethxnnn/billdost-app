-- 0007: updated_at triggers and the customer-stats trigger (blueprint B.6).
-- Stock is maintained by the money RPCs, not by triggers: a trigger on
-- invoice_items cannot see the reason, the log type or the shop context
-- cleanly, and would fight with RPC transactions.

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function app.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function app.set_updated_at();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function app.set_updated_at();

create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function app.set_updated_at();

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function app.set_updated_at();

-- -------------------------------------------------- customer stats (delta)
-- One trigger owns total_billed, total_paid, bill_count and last_billed.
-- The old router code wrote these from three places and drifted.
create or replace function app.apply_invoice_stats(
  p_customer_id uuid, p_billed numeric, p_paid numeric, p_count int
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_customer_id is null then
    return;
  end if;
  update public.customers
  set total_billed = greatest(0, total_billed + p_billed),
      total_paid = greatest(0, total_paid + p_paid),
      bill_count = greatest(0, bill_count + p_count),
      last_billed = case
        when p_count > 0 then now()
        when p_count < 0 then (
          select max(created_at) from public.invoices
          where customer_id = p_customer_id and status = 'active'
        )
        else last_billed
      end
  where id = p_customer_id;
end;
$$;

create or replace function app.invoice_stats_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      perform app.apply_invoice_stats(new.customer_id, new.total, new.amount_paid, 1);
    end if;
    return new;
  end if;

  -- UPDATE: subtract the old contribution, add the new one.
  if old.status = 'active' then
    perform app.apply_invoice_stats(old.customer_id, -old.total, -old.amount_paid, -1);
  end if;
  if new.status = 'active' then
    perform app.apply_invoice_stats(new.customer_id, new.total, new.amount_paid, 1);
  end if;
  return new;
end;
$$;

create trigger invoices_customer_stats
  after insert or update of status, total, amount_paid, customer_id on public.invoices
  for each row execute function app.invoice_stats_trigger();
