# BillDost Admin Portal

The control centre for BillDost: the Today queue, the applications
pipeline, shop setup and activation, shop health, the issue centre,
broadcasts, finance lite, the team workspace and the audit log. It
is a separate Next.js app from the shop app (which lives in
`../billdost/`). The two apps share exactly one thing at runtime:
the same Supabase project. Nothing else is shared, and nothing in
this folder imports from the shop app folder.

The shell is Dock + Canvas: a frosted header with the text wordmark,
the screen as a calm canvas, and a floating dock as the only
navigation. Every screen uses one card system (fixed leading tile
or avatar column, shared baselines, trailing values right-aligned
in tabular numbers, 20px radius).

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
npm run test        # vitest: tokens, role matrix, attention engine, team stats
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

## Theme

Light is the default and there is no automatic theme, ever: dark
applies only when an admin picks it. The option lives in the
profile menu (avatar, top right), in My profile, and in Settings.
The choice is stored per admin user in `admin_users.ui_theme` and
mirrored to localStorage (`billdost-admin-theme`) so it applies
before first paint and follows the account across devices.

## The Pipeline shows every shop

The Pipeline board is driven by website applications, and it also
includes shops created directly in the Setup Studio, which have no
application row. Direct shops are mapped into the same stages from
their lifecycle status (awaiting approval, setup returned, pending
activation, live, suspended into Live with a flag), carry a small
Direct tag, and link to the shop page with one status-driven action.
No shop can exist in the system and be invisible on the board.

## The founder approval gate

Teammates may help with onboarding (work applications, log calls,
prepare the full shop setup), but the review and the decision stay
with the founder. This is enforced in the database and the API,
never just by hiding buttons:

- A shop created by support lands in the new status
  `awaiting_approval`. A shop created by the founder or a
  co-founder is approved inline (the approval is audit-logged) and
  lands in `pending_activation`.
- The founder approves (`awaiting_approval` to
  `pending_activation`) or sends the setup back
  (`awaiting_approval` to `setup_returned`) with a note the
  preparer sees, from the approval card on the shop page. The
  preparer fixes and marks it ready again. Both actions need the
  `activation_approve` capability (founder and co-founder only)
  and are audit-logged.
- Activation links need the `activation_actions` capability
  (founder and co-founder only; support lost it in the gate). The
  issue route and `admin_issue_activation_tx` both refuse any shop
  whose status is not `pending_activation`, so an unapproved shop
  can never receive a token.
- Shops awaiting approval surface on the founder's Today queue as
  their own attention item.

## Team tracking, presence and the Today queue

- Assignments: applications (`access_requests.assignee_id`), shops
  (`shops.support_owner_id`) and issue groups
  (`client_errors.assignee_id`) can be assigned or claimed from the
  Pipeline, the detail pages and the Issue Centre. Every change
  writes the audit log. A Start action stamps `started_at`; the
  stamp clears when the status advances. The Team screen reads the
  latest started item per member as "doing now".
- Call logs: one tap on an application or shop page records the
  outcome (answered, no answer, busy, callback requested, not
  interested, converted, other) plus an optional note into
  `call_logs`, and into the audit log. Team stats and the activity
  timeline are computed from these two logs only.
- Presence: the shell sends a heartbeat at most every two minutes
  (`POST /api/me/heartbeat`, throttled again server-side), and every
  audited action refreshes `admin_users.last_active_at`. The Team
  screen shows "Active now" under five minutes, else "Active Xh
  ago".
- The Today queue is computed by `src/lib/attention.ts` from real
  rows: unassigned applications in new over 2 hours; called with no
  follow-up in 24 hours; unused activation tokens expiring within
  12 hours; shops pending activation over 24 hours; open issues
  unassigned or untouched for 48 hours; live shops with no invoice
  in 7 days; shops with an overdue plan; and, for founders, shops
  awaiting approval. Items are ranked by an urgency score and the
  top ones render with their primary action inline.
- Team RBAC: everyone can open the Team screen (`team_view`):
  directory, presence, assignment loads, the timeline. Founders and
  co-founders see everyone's today counts; other roles see only
  their own counts. Adding, disabling and re-roling people stays
  behind `team_manage`.

## How it connects to the shop app

- Same Supabase project, same database. The portal's tables and RPCs
  are migrations `0017` to `0022` in `../billdost/supabase/migrations/`.
  Migration `0022` adds the approval gate, assignments, call logs,
  presence and the per-user theme.
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
