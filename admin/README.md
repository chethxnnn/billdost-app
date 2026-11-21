# BillDost Admin Portal

The control centre for BillDost: applications inbox, shop setup and
activation, shop health, the issue centre, broadcasts, finance lite,
team roles and the audit log. It is a separate Next.js app from the
shop app (which lives in `../billdost/`). The two apps share exactly
one thing at runtime: the same Supabase project. Nothing else is
shared, and nothing in this folder imports from the shop app folder.

Access model in one paragraph: a person enters the portal only when
their Supabase Auth user has a row in `admin_users` with status
`active`. Every screen and every API route re-checks that row and the
role's capabilities (`src/lib/roles.ts`) on the server. All data is
read and written server-side with the service-role key after those
checks; the key never reaches the browser. Every mutating action
writes a row to `admin_audit_log`. Admins never see a shop's
password: password help is a reset link, and a shop's first password
is set by the owner through a one-time activation link whose raw
token is never stored (only its SHA-256 hash is).

## Run it locally

```bash
cd admin
npm install        # .npmrc already sets legacy-peer-deps (see the note in it)
cp .env.example .env.local   # fill in the values below
npm run dev        # http://localhost:3000 (use another port if the shop app is running)
```

Checks:

```bash
npm run test        # vitest: token hashing/expiry, role matrix
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
```

## Environment variables

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The shared Supabase project URL (same as the shop app) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same project, anon key. Used only for the admin login session |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never commit a real value, never prefix with NEXT_PUBLIC |
| `NEXT_PUBLIC_SHOP_APP_URL` | Default `https://app.billdost.in`. Activation links are built from this |
| `NEXT_PUBLIC_ADMIN_URL` | Default `https://admin.billdost.in` |
| `NEXT_PUBLIC_LANDING_URL` | Default `https://billdost.in` |
| `WHATSAPP_CLOUD_API_TOKEN` | Optional. Platform sending identity (same Meta app as the shop app) |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional. The BillDost business number's Phone Number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional, shown in Settings |
| `WHATSAPP_TEMPLATE_ACTIVATION` | Optional. Default `billdost_activation_v1` |
| `WHATSAPP_TEMPLATE_BROADCAST` | Optional. Default `billdost_announcement_v1` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Optional. Default `en_US` |

When the WhatsApp variables are absent, the portal does not pretend:
activation falls back to a copyable link and broadcasts record a
`not_connected` entry in the broadcast history.

## Seed the founder (one time, by hand)

There are no hardcoded emails or passwords anywhere in this app. The
first admin is created deliberately:

1. In the Supabase dashboard for the shared project, go to
   Authentication, Users, and add a user with the founder's email
   and a password. Copy the user's UUID.
2. Run this in the SQL editor, replacing the two values:

```sql
insert into public.admin_users (auth_user_id, display_name, email, role, status)
values ('<the-auth-user-uuid>', 'Founder Name', 'founder@example.com', 'founder', 'active');
```

3. Sign in at the portal with that email and password. Everyone else
   is added later from the Team screen, which creates their login
   and their role in one step.

## How it connects to the shop app

- Same Supabase project, same database. The portal's tables and RPCs
  are migrations `0017` to `0021` in `../billdost/supabase/migrations/`.
- Shop setup calls the `admin_create_shop_tx` RPC; activation issue
  and consume run through `admin_issue_activation_tx`,
  `activation_lookup` and `activation_consume_tx`. The consume step
  runs inside the shop app (its `/api/activate/*` endpoints), because
  that is where the owner lands.
- The Issue Centre reads the shop app's `client_errors` table, the
  same rows the shop app's `/api/client-errors` endpoint writes.
- In-app announcements written here are read by the shop app through
  its own service role.
- Token hashing parity matters: `src/lib/tokens.ts` here and
  `src/lib/token-hash.ts` in the shop app both compute the SHA-256
  hex digest of the raw token. A unit test pins the algorithm; if one
  side ever changes, activation links break, so neither side changes
  alone.

## Deploying

See section 6 of `../billdost/DEPLOY.md`: a second Vercel project
with Root Directory `admin`, the `admin.billdost.in` CNAME, the
Supabase Auth redirect URLs, and the one-time founder seed above.
