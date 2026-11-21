# Performance Pass (Stage 5, 21 Nov 2026)

## Method

Next.js 16.2.7 no longer prints Size or First Load JS columns in the
route table (verified in both the Turbopack build and a webpack
build). Route sizes below were computed from the webpack build
manifests (rootMainFiles plus the union of each route's
client-reference-manifest chunks, gzip level 9). Treat them as an
upper bound: some referenced chunks load lazily, not at first paint.

## Baseline (before this pass)

- Shared by every route (rootMainFiles): 416.7 KiB raw / 122.4 KiB
  gzip. Every route's total, however, came to about 1015 KiB raw /
  296 KiB gzip, because the shell, providers and globally mounted
  components ride along.
- Heaviest routes (totals, gzip): /analytics 400.9, /invoices/new
  369.8, /quotations/new 360.6, /pos 343.1, /catalog 338.9,
  /onboarding 338.6, /dashboard 336.8 KiB.

## What was outsized and what changed

1. PDF libraries in the billing bundles. `jspdf` plus
   `html2canvas-pro` are the heaviest single dependencies in the app
   and were statically imported by `InvoicePreview` and
   `QuotationPreview`, so they shipped inside /invoices/new,
   /quotations/new, /invoices/[id], /quotations/[id] and /pos first
   load even though they are only needed at the moment a PDF is
   generated. Both components now load them with `import()` inside
   the PDF build function (the Next.js documented on-demand library
   pattern). They are out of those routes' initial bundles by
   construction; the build stays green and PDF generation code is
   otherwise untouched.
2. Chatbot in every dashboard route. The AI chatbot (AI SDK, voice
   input) was statically mounted by the dashboard layout. It is now
   mounted through `src/components/ChatbotLazy.tsx`, a client wrapper
   using `next/dynamic` with `ssr: false` (the layout is a Server
   Component, where `ssr: false` and code splitting via `dynamic`
   are not supported directly, per the Next 16 lazy-loading guide).
   The chatbot loads as its own chunk on dashboard routes instead of
   inside each route's bundle.
3. Nothing else was restructured. /analytics (recharts) and /catalog
   keep their chart/grid libraries: they are the page's core content,
   not rarely used modules, and splitting them would be marginal
   gain for real risk.

## Measured timing (mid-range Android profile)

Playwright, Moto G-class profile: 412x915 touch viewport, 4x CPU
throttling, Fast 3G latency (150 ms, 1.6 Mbps down), production
build, placeholder env, public surfaces (no live session exists yet):

- Tap feedback to next painted frame on /login: 13.3 ms (design
  target: under 100 ms).
- Client-side navigation /login to /signup: 276 ms (design band:
  200 to 300 ms; top edge, includes the throttled network fetch of
  the route payload).
- Cold /login under the same profile: DOMContentLoaded 1053 ms,
  load event 2714 ms.

The authenticated billing flow itself (tap to bill saved) can only
be timed against a live Supabase session; that measurement is part
of the blocked authenticated end-to-end run in docs/beta-gate.md.
