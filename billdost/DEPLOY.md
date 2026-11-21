# BillDost Deploy Runbook

For Chethan, to run in one sitting at beta handover. Order matters:
database first (section 2), then the app (section 3), then WhatsApp
(section 4). Rollback is section 5. Nothing in this runbook needs a
developer; if a step fails, stop and hand this file back with the
exact error.

Repo layout reminder: this runbook sits in the app folder `billdost/`
inside the repo. Migrations are in `billdost/supabase/migrations/`,
seed is `billdost/supabase/seed.sql` (local only, NEVER run on the
live project).

## 1. Environment variables

Copy `.env.example` to `.env.local` locally, and enter the same set
in Vercel (Project, Settings, Environment Variables, Production and
Preview). Where each value comes from:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard, your live project, Project Settings, API, Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same screen, `anon` `public` key. Safe in the browser; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | Same screen, `service_role` `secret` key. Server only. Never paste this anywhere public, never commit it |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio (aistudio.google.com), Get API key. Powers the `/api/chat` assistant |
| `NEXT_PUBLIC_APP_URL` | The production URL, for example `https://billdost.in` (no trailing slash). Used to build CA share and PDF links |
| `PORT` | Leave unset on Vercel (it manages the port). `3000` only for a self-hosted run |
| `NODE_ENV` | Set by the host. Do not set it manually on Vercel |
| `WHATSAPP_CLOUD_API_TOKEN` | Meta App Dashboard, WhatsApp, API Setup (section 4). Leave blank until section 4 is done |
| `WHATSAPP_PHONE_NUMBER_ID` | Same Meta screen, the BillDost sending number's Phone Number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Same Meta screen, WhatsApp Business Account ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | A random string you invent (20+ characters). You type the same value into the Meta webhook screen in section 4 |
| `WHATSAPP_APP_SECRET` | Meta App Dashboard, Settings, Basic, App Secret |
| `WHATSAPP_TEMPLATE_INVOICE` | Optional. Default `billdost_invoice_v1` |
| `WHATSAPP_TEMPLATE_QUOTATION` | Optional. Default `billdost_quotation_v1` |
| `WHATSAPP_TEMPLATE_REMINDER` | Optional. Default `billdost_payment_reminder_v1` |
| `WHATSAPP_TEMPLATE_LOW_STOCK` | Optional. Default `billdost_low_stock_v1` |
| `WHATSAPP_TEMPLATE_TEST` | Optional. Default `hello_world` (Meta's built-in test template) |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Optional. Default `en_US`. Must match the language the templates were approved in |

Retired: `NEXT_PUBLIC_WHATSAPP_SERVICE_URL` (the old whatsapp-web.js
service) is no longer read by the app. Delete it from Vercel if it is
still there.

## 2. Supabase: the EXISTING live project

Your live project already has the 12 original tables with real data.
The migrations in this repo describe that schema plus everything the
rebuild adds. Do NOT run them blind, top to bottom, on live: files
0002 and 0003 would try to create tables that already exist. The
correct path is the capture, compare, repair approach below (the
blueprint's B.7 path). It takes one focused sitting.

### 2.1 Freeze and back up first

1. Pick a quiet window (after shop hours). Tell pilot shops the app
   may be down briefly.
2. Supabase dashboard, your project, Database, Backups: take a
   manual backup if your plan offers it.
3. Also make an off-Supabase copy. On your machine with the Supabase
   CLI installed and linked (`supabase link --project-ref <ref>`,
   the ref is the part of the dashboard URL after `/project/`):

   ```bash
   supabase db dump -f live-backup-schema.sql
   supabase db dump --data-only -f live-backup-data.sql
   ```

   Store both files outside Supabase (your drive plus one more copy).
   Keep them for at least 30 days after go-live.
4. In the dashboard Table Editor, note the row counts of `shops`,
   `invoices`, `customers`, `products`. You will compare these after
   the migration; they must not go down.

### 2.2 Capture the live schema

```bash
supabase db pull --file live-captured.sql
```

This writes the live schema exactly as it exists today. Keep the
file; it is the ground truth for the comparison in 2.3.

### 2.3 Compare against the repo migrations

Compare `live-captured.sql` table by table against
`supabase/migrations/0002_baseline_core.sql` and
`0003_baseline_billing.sql`:

- A column that exists live but not in the baseline: keep it. Add it
  to your notes; do not drop live columns in this deploy.
- A column that exists in the baseline but not live: it is one of the
  rebuild's new columns. It gets added by the repair file in 2.4.
- A type mismatch on the same column: stop and hand back. Do not
  improvise a type change on live data.

Quick way to list what live is missing, in the dashboard SQL Editor:

```sql
-- Columns the new code expects, checked one table at a time.
-- Returns the columns that EXIST; anything from the baseline file
-- not in this list is missing on live and belongs in the repair file.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

Save the output. Diff it against the `create table` blocks in 0002
and 0003 by eye, table by table (12 tables, about 15 minutes).

### 2.4 Baseline the migration history, then apply the delta

The goal state: live ends with the effect of migrations 0001 to
0016, without re-creating what already exists.

1. In the SQL Editor, first apply the genuinely additive parts for
   the baseline, in this order, by pasting the named files and
   running them. These files are written defensively (new columns
   use `add column if not exists` in the later files; for 0002/0003
   do NOT paste the `create table` blocks for tables that already
   exist live; paste only the `alter table ... add column` parts and
   any `create table` blocks for tables your 2.3 diff says are
   missing):

   - `0001_extensions_and_helpers.sql` (extensions, the `app` helper
     schema and functions; safe on live, it creates nothing that
     exists)
   - The additive parts of `0002_baseline_core.sql` and
     `0003_baseline_billing.sql` per your diff
   - `0004_constraints_and_indexes.sql` (run AFTER the data cleanup
     in 2.5; constraints will fail on duplicate data)
2. Then apply, in filename order, pasting each file into the SQL
   Editor and running it:

   `0005_rls_and_grants.sql`, `0006_money_rpcs.sql`,
   `0007_triggers.sql`, `0008_staff_unification.sql`,
   `0009_whatsapp_tables.sql`, `0010_phase1_tables.sql`,
   `0011_phase2_tables.sql`, `0012_phase3_tables.sql`,
   `0013_rpc_only_writes.sql`, `0014_onboarding_tx.sql`,
   `0015_stage4_features.sql`, `0016_fefo_batch_allocation.sql`.

   Stop on the first error. Fix nothing by editing a migration file;
   hand back with the error text.
3. Mark the history so a future `supabase db push` does not try to
   re-run these (only if you use the CLI to manage this project):

   ```bash
   supabase migration repair --status applied 0001 0002 0003 0004 \
     0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015 0016
   ```

4. NEVER run `supabase/seed.sql` on live. It creates a demo shop and
   a known-password user for local development only.

### 2.5 Data cleanup before constraints (only if 0004 complains)

Run these checks in the SQL Editor and fix what they return, in
this order, before re-running 0004:

```sql
-- Duplicate bill numbers inside one shop
select shop_id, invoice_number, count(*)
from public.invoices group by 1, 2 having count(*) > 1;

-- Duplicate customer phones inside one shop
select shop_id, phone, count(*)
from public.customers
where phone is not null and phone <> ''
group by 1, 2 having count(*) > 1;

-- Bills whose stored total does not add up (legacy, pre-fix bills)
select id, invoice_number, total, taxable_amt, cgst_amt, sgst_amt, igst_amt
from public.invoices
where abs(total - (taxable_amt + cgst_amt + sgst_amt + igst_amt
  + coalesce(round_off_amt, 0))) > 0.01;
```

Rules for fixes: renumber the LATER duplicate bill (keep the first),
merge duplicate customers onto the row that has bills, and do NOT
rewrite legacy bill totals; the corrected money engine applies from
go-live forward, and the CA cutover date is the day this deploy
lands. If a check returns a lot of rows, stop and hand back instead
of mass-editing.

Also backfill the document counters so new bills never reuse a
number:

```sql
update public.shops s set invoice_counter = greatest(
  s.invoice_counter,
  coalesce((select max((regexp_match(i.invoice_number, '(\d+)$'))[1]::int)
            from public.invoices i where i.shop_id = s.id), s.invoice_counter));
update public.shops s set quotation_counter = greatest(
  s.quotation_counter,
  coalesce((select max((regexp_match(q.quotation_number, '(\d+)$'))[1]::int)
            from public.quotations q where q.shop_id = s.id), s.quotation_counter));
```

### 2.6 Verify the database

In the SQL Editor:

```sql
-- Row counts must match or exceed the 2.1 numbers
select (select count(*) from public.shops) as shops,
       (select count(*) from public.invoices) as invoices,
       (select count(*) from public.customers) as customers,
       (select count(*) from public.products) as products;

-- RLS must be on for every public table (rowsecurity = true)
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

-- RPC smoke test: ask for the next bill number of a real shop.
-- This CONSUMES one number (the counter moves up by one), which is
-- fine: gaps in bill numbers are legal, duplicates are not.
select public.next_document_number('<a real shop id>', 'invoice');

-- FEFO table exists and is locked down (expect: RLS on, no anon grant)
select rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'invoice_batch_allocations';
```

Then log in to the deployed app (section 3) as a shop owner and
create one small real bill end to end. That is the true smoke test.

## 3. Vercel: deploy the app

1. Push or merge the `feat/ultimate-v2` branch only after your own
   review (you keep it or revert it; nothing here auto-deploys).
2. Vercel dashboard, your BillDost project (already imported from
   this repo): confirm Root Directory is `billdost` and the
   framework preset is Next.js.
3. Settings, Environment Variables: enter every variable from
   section 1 for Production AND Preview.
4. Deployments: deploy the branch first (Vercel builds a Preview
   URL for any pushed branch). Open the Preview URL and run the
   smoke list: login, dashboard loads, create a bill, record a
   payment, download the PDF, open the GST report, log out.
5. Promote: merge the branch into `main` (or use Promote to
   Production on the preview deployment). Production rebuilds from
   `main`.
6. Confirm `NEXT_PUBLIC_APP_URL` in Production equals the real
   domain, then re-check one CA share link and one PDF link on the
   live domain.

## 4. WhatsApp Cloud API (official, no ban risk)

The app code is complete; this section is the Meta-side setup you do
once, with the app already deployed (the webhook needs a live URL).

1. Go to developers.facebook.com, My Apps, Create App, type
   Business, name it BillDost. Add the WhatsApp product.
2. WhatsApp, Getting Started: note the test Phone Number ID and
   WhatsApp Business Account ID. Add your own mobile as a recipient
   and send Meta's test message to prove the pipe works.
3. Connect a real sending number: WhatsApp, API Setup, Add phone
   number. Use a number that is NOT active on the regular WhatsApp
   app (a fresh SIM is cleanest); complete the SMS/voice code
   verification. Note the real Phone Number ID.
4. Business verification: Meta Business Settings for the BillDost
   business, Business Info, start verification with the business
   documents Meta asks for. Sending limits stay low until this
   clears; plan the template step after it.
5. Create and submit these message templates (WhatsApp Manager,
   Message Templates), category Utility, language matching
   `WHATSAPP_TEMPLATE_LANGUAGE` (default `en_US`):
   - `billdost_invoice_v1`: document header (the bill PDF), body with
     exactly 3 text variables in this order: shop name, invoice
     number, amount. Example body: `Namaste, {{1}} se aapka bill
     {{2}}, kul {{3}}. Dhanyavaad!`
   - `billdost_quotation_v1`: same shape: document header, body
     variables shop name, quotation number, amount.
   - `billdost_payment_reminder_v1`: body only, exactly 3 text
     variables in this order: customer name, shop name, amount.
   - `billdost_low_stock_v1`: body only, for the owner digest,
     exactly 3 text variables in this order: shop name, count of
     low items, item list text.
   Wait for Approved status on each before the test send.
6. Set the Vercel env vars from section 1 (token, phone number ID,
   WABA ID, app secret, and a `WHATSAPP_WEBHOOK_VERIFY_TOKEN` you
   invent), then redeploy.
7. Webhook: Meta App, WhatsApp, Configuration: Callback URL
   `https://<your domain>/api/webhooks/whatsapp`, Verify token = the
   exact `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value. Click Verify and
   Save, then subscribe to the `messages` field. (Delivery status
   updates land in the app through this webhook.)
8. Permanent token: the API Setup token expires in 24 hours. Create
   a System User in Business Settings, assign the app with WhatsApp
   permissions, generate a long-lived token, and replace
   `WHATSAPP_CLOUD_API_TOKEN` in Vercel with it. Redeploy.
9. Test send: in the app, Settings, WhatsApp, send the test message
   to your own number; then create a real bill and use Send on
   WhatsApp. In the app, the send should show status sent; in Meta's
   API Setup screen the message counters move.
10. Per-shop numbers (later): a shop can connect its own number from
    Settings, WhatsApp; its Phone Number ID is stored in the
    `whatsapp_connections` table and wins over the shared env number.

Until steps 1 to 9 are done, the app honestly shows WhatsApp as Not
Connected and offers share options instead. Nothing is faked.

## 5. Rollback

App rollback (fast, do this first if the new build misbehaves):

- Vercel, Deployments: open the previous production deployment and
  choose Promote to Production (or Rollback). The old build is live
  again in about a minute. Or, in git: revert the merge commit on
  `main` and push; Vercel rebuilds the old code.

Database rollback (careful):

- The migrations in this deploy are additive by design: new tables,
  new columns, new functions, RLS policies. The new app code is the
  only thing that needs them, and the OLD app code ignores new
  tables and columns, so rolling the app back does NOT require
  rolling the database back. Do not drop tables or columns to
  "undo" the deploy.
- The one behaviour change to know about: once `0013` is applied,
  direct browser writes to billing tables are closed and writes go
  through the RPCs. The old pre-rebuild app wrote directly, so if
  you roll the APP back past the rebuild while 0013 is live, bill
  creation in the old app will fail. In that case the safe rollback
  pair is: app rollback PLUS ask for help re-opening the 0013
  policies (a small SQL change, do not improvise it on live data).
- If data itself was damaged: restore from the section 2.1 backups.
  A restore loses everything written after the backup, so it is the
  last resort, after the app rollback.
- Keep the 2.1 backups and the `live-captured.sql` file for at least
  30 days after go-live.
