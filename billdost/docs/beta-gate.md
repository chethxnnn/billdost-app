# Beta Gate Scoring (Stage 5, 21 Nov 2026)

Every item of `~/workspace/billdost/BETA_READINESS.md`, scored
honestly as PASS, FAIL, or BLOCKED-ON-CHETHAN, with the evidence.
Fresh verification for this scoring, all run on the final tree:
`npx vitest run` 75/75 passed, `npx tsc --noEmit` clean,
`npm run build` green (42 routes), local PG harness fresh run:
migrations 0001 to 0016 plus seed apply clean, 20/20 assertion
groups passed (14 prior-behavior regression groups, 6 new FEFO
groups), click audit 314 controls, viewport sweep 72/72 checks.

Summary: no FAIL items. Five BLOCKED-ON-CHETHAN items, all of them
external by nature (they need Chethan's live accounts, hardware, or
professional sign-off), listed together at the end.

## Correctness

### 1. Every calculation verified: GST suite green, server recomputes all money, no client-trusted totals
Status: PASS
Evidence: `src/lib/money.ts` is the single money engine;
`src/lib/__tests__/money.test.ts` covers the blueprint cases
including the regression that tax on a 10 percent discount is 162,
not the old buggy 180; full vitest suite 75/75. Invoice and
quotation create schemas accept facts only (no totals fields), the
routers recompute server-side, and the database re-validates:
harness group `forged_totals_rejected` proves a payload whose
totals do not reconcile with its lines is refused (23514).

### 2. Every logic flow tested end to end
Status: BLOCKED-ON-CHETHAN (all locally verifiable parts PASS)
Evidence by flow:
- Billing paid, partial, udhaar: PASS at the database contract
  level. Harness groups `create_invoice_happy_path` (number
  INV-1001 from the seed counters, stock deducted, SALE log),
  `record_payment_partial_then_full`, `overpayment_rejected`,
  `bulk_mark_paid`. Udhaar ageing and oldest-first payments shipped
  in Stage 4 with their RPCs in migration 0015.
- Quotation to invoice: PASS. Harness group
  `convert_quotation_creates_invoice`; FEFO probe also converted a
  batch-tracked quotation and cancelled it back cleanly.
- Payments: PASS, same harness groups as billing; the payments
  ledger is written by the RPCs, never by the client.
- Staff invite to active: PASS at the contract level. Harness group
  `accept_staff_invite_activates_manager` flips the seeded invited
  manager to active through the real `accept_staff_invite` RPC.
- Onboarding: PASS at the contract level. Migration 0014 moved
  completion behind one server transaction; the click audit
  code-verified every onboarding control (and removed the fake PIN
  step, see item 3).
- PDF: PASS, code-verified. Real pagination, terms rendered,
  shop-first footer (Stage 3); download controls traced in the
  click audit; PDF libraries now load on demand (docs/perf-pass.md).
- GST report and exports: PASS for generation. GSTR-1 JSON builder
  and Tally XML export shipped in Stage 4 with unit tests in the
  75-test suite; export controls traced in the click audit.
- WhatsApp send: code complete (Cloud API module, webhook, status
  writeback, honest Not Connected states), live send is blocked,
  see blocked item B.
- The remaining gap is a browser-driven run of these flows against
  a live Supabase project with a real login session. That is
  blocked item A. Nothing about it can be faked locally, and it is
  not scored around.

### 3. No false cases: no fake numbers, no prop buttons, no dead screens, no placeholder text presented as real
Status: PASS
Evidence: docs/click-audit.md walked all 42 routes: 314 controls
checked, 308 works, 5 fixed (hover-only controls unreachable on
touch: customers edit/delete, inventory adjust, dashboard low-stock
link, Magic Extract row remove), 1 removed (onboarding "4-Digit
Quick PIN" step: the PIN was never sent, stored, or usable for any
login, so the step was a false promise and is gone). The old
hard-coded "Growth 14.5%" dashboard figure was deleted in Stage 3
and replaced with computed growth. Repo sweep on the final tree:
zero TODO, FIXME, or lorem text in src. Two honest exceptions,
neither presented as real data: the strings `INV-XXXX` and
`QT-XXXX` are transient fallbacks shown only while the real next
document number loads from the server, and two code comments use
the word placeholder to describe a layout-shift guard.

### 4. Cross-tenant isolation: no shop can read or touch another shop's data
Status: PASS (local PG), live two-account check rides with blocked item A
Evidence: RLS is enabled on every public table with member-scoped
policies (migrations 0005, 0010 to 0016 follow the same pattern);
migration 0013 closed direct writes so billing mutations go through
security-definer RPCs that re-check shop membership with
`app.assert_shop_role`. Harness group `rls_stranger_sees_nothing`:
as an authenticated stranger, invoice selects return 0 rows and a
direct insert is denied.

## Design and responsive

### 5. One design system, KPMG animation standard, speed rule enforced
Status: PASS (code level)
Evidence: Stage 3 unified the app on one iOS design system (the
second warm-charcoal system was removed, 205 usages), motion is a
240 ms content-only transition system using transform and opacity,
the shell never remounts between routes, `prefers-reduced-motion`
is respected, and delight is limited to named moments per the
design brief. Measured timing on public surfaces under a throttled
mid-range Android profile is under Performance below. A physical
device 60 fps check is a pilot-week activity, not a code gate.

### 6. Viewport matrix passed with screenshots, 360 to 1920, alignment clean, primary actions reachable
Status: BLOCKED-ON-CHETHAN (public and auth pages PASS)
Evidence: docs/viewport-sweep.md: login, signup, forgot-password,
reset-password, terms, privacy, the /ca/[token] invalid-token
state, the landing redirect, and the 404 page, each at 360, 390,
430, 768, 820, 1280, 1440, 1920: 72/72 checks with zero horizontal
overflow (scrollWidth equalled innerWidth in every check),
screenshots inspected for the key pages, no fixes needed.
Authenticated dashboard pages cannot be swept without a live
Supabase session; Stage 3 swept the dashboard shell at 360, 768,
1280 only. The full authenticated sweep is part of blocked item A.

### 7. Accessibility floor: contrast, 44 px targets, labels
Status: PASS
Evidence: Stage 3 raised the muted text token to AA contrast and
removed sub-44 px list targets; Stage 4 labelled icon buttons;
Stage 5 click audit fixed the last hover-only controls and gave
them 44 px touch targets (docs/click-audit.md, fixes 1 to 5).

## Performance

### 8. Billing flow measured on a mid-range Android phone profile: tap feedback under 100 ms, transitions 200 to 300 ms, no blank-page navigation
Status: BLOCKED-ON-CHETHAN (public-surface measurements PASS)
Evidence: docs/perf-pass.md. Under a Moto G-class profile (4x CPU
throttle, Fast 3G latency) against the production build: tap
feedback to next painted frame on /login was 13.3 ms (target under
100 ms), client-side navigation /login to /signup completed in
276 ms (inside the 200 to 300 ms band), cold /login
DOMContentLoaded 1053 ms. The billing flow itself (tap to saved
bill) needs an authenticated session against live Supabase, so its
timing is part of blocked item A. Route weight was also reduced in
this pass: the PDF libraries and the chatbot no longer ride in the
initial bundles of the billing and dashboard routes
(docs/perf-pass.md).

## Deploy readiness

### 9. Production build green, env documented, migrations applied to the target Supabase project in order, restore-tested backup taken
Status: BLOCKED-ON-CHETHAN (build and docs PASS)
Evidence: fresh `npm run build` green, 42 routes, on the final
tree; `npx tsc --noEmit` clean; vitest 75/75. `.env.example` lists
every variable the code reads, and DEPLOY.md section 1 maps each
variable to where its value comes from. Applying migrations 0001
to 0016 to Chethan's existing live project (capture, compare,
repair path) and taking the restore-tested backup are his steps in
DEPLOY.md section 2; they cannot be done from here without his
project access. Blocked item A.

### 10. WhatsApp path decided and working end to end on at least one real number before handover
Status: BLOCKED-ON-CHETHAN (decision and code PASS)
Evidence: the decision is made and implemented: official WhatsApp
Cloud API only, the unofficial whatsapp-web.js service is retired
from the send path, sends fail honestly with Not Connected until
configured, webhook status writeback is live in code
(`src/app/api/webhooks/whatsapp/route.ts`). A real send needs the
Meta app, number, approved templates, and tokens from Chethan's
Meta account: DEPLOY.md section 4 is the step-by-step. Blocked
item B.

### 11. Error surfaces are honest: no raw stack trace, no silent failure
Status: PASS
Evidence: personalized error surfaces shipped in Stage 3
(`src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`): calm
"We'll be back" headline, the user's own activity recap from their
snapshot, data-safe reassurance, retry and dashboard actions, and
technical details only behind the developer expander. The 404 page
was rendering-verified in the viewport sweep. Stage 4 added the
client error log endpoint (`/api/client-errors`) feeding the
future admin issue centre, so failures are recorded server-side
instead of vanishing.

## Blocked items (complete list, all BLOCKED-ON-CHETHAN)

A. Live Supabase migration run plus authenticated end-to-end:
   apply DEPLOY.md section 2 to the real project, then run the
   browser flows (signup, onboarding, billing, staff login) and the
   authenticated viewport and billing-timing sweeps against it.
B. Live Meta WhatsApp send: DEPLOY.md section 4 (Meta app, WABA,
   number, system-user token, four templates approved, webhook),
   then one real invoice send.
C. Physical thermal printer test: the 58 mm and 80 mm receipt
   layouts are print-CSS code-verified; a real printer run needs
   the pilot shop's hardware.
D. Tally import into real TallyPrime: the XML export is generated
   and unit-tested; importing it into an actual TallyPrime company
   needs Chethan's Tally installation.
E. CA-checked GSTR-1 sample: the JSON builds from the same money
   engine the harness proves; a CA reviewing one real month's
   output is a professional sign-off only Chethan can arrange.

## Pilot plan readiness (from BETA_READINESS, process items)

- Chethan picks the 2 to 3 shops: his action, after A and B.
- Feedback loop and same-day money/data triage: process, starts
  with the pilot; the client error log endpoint (item 11) is the
  technical half of it and is in place.
- Pilot success measures (7 straight days of real billing, bill
  creation under 10 seconds, zero money mismatches): measured
  during the pilot, cannot be scored before it.
