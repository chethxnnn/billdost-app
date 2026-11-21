# BillDost Viewport Sweep (Stage 5, Task C)

Date: 21 November 2026
Scope: public (unauthenticated) pages only, production build, 8 viewport widths.

## Method

- Work was done in a separate git worktree at /tmp/bd-sweep (detached at HEAD 3e41aaf, branch feat/ultimate-v2 state) so the main build tree was not disturbed. The worktree was removed after the sweep.
- The app in the worktree used a placeholder .env.local (Supabase URL http://127.0.0.1:54321, placeholder anon and service role keys, placeholder Gemini key, NEXT_PUBLIC_APP_URL http://127.0.0.1:3100, WhatsApp variables blank). No live backend was contacted.
- node_modules was shared from the main tree. Turbopack rejects a node_modules symlink that points outside the worktree filesystem root, so the directory was bind mounted inside the build and server session instead of symlinked. Build behaviour is otherwise identical.
- Build: `npm run build` (Next.js 16.2.7, Turbopack), exit code 0. Compiled successfully in 97s, TypeScript finished in 23.1s, 39 static pages generated.
- Server: `npm run start -- -p 3100` (production server on http://127.0.0.1:3100).
- Browser checks: Playwright Core 1.65.1 driving the cached Chromium headless shell (chromium_headless_shell-1248) from ~/.cache/ms-playwright.
- For every page and width the page was loaded, allowed to settle (DOM content loaded, then network idle with a 12s cap, plus a 1.2s settle wait), and then measured in the page: pass means `document.documentElement.scrollWidth <= window.innerWidth + 1` and the same check for `document.body.scrollWidth`. A full page screenshot was saved for every check.
- Widths: 360, 390, 430 (height 844), 768, 820 (height 1024), 1280, 1440, 1920 (height 900).

## Pages swept

- `/` (root): redirects and lands on `/login` at every width (final URL http://127.0.0.1:3100/login, status 200 after redirect).
- `/login`, `/signup`, `/forgot-password`, `/reset-password`: status 200 at every width.
- `/terms` (title "Terms of Use · BillDost"), `/privacy` (title "Privacy Policy · BillDost"): status 200 at every width.
- `/ca/invalid-token-for-sweep`: status 200 at every width, renders the honest invalid link state (a centred card reading "Link nahi mila").
- `/this-page-does-not-exist`: status 404 at every width, renders the personalised not found page ("Ye page nahi mila" with a Dashboard button).

## Results

72 checks in total (9 pages x 8 widths). 72 passed, 0 failed. No horizontal overflow was found anywhere: in every check the document scrollWidth and body scrollWidth exactly equalled the viewport innerWidth.

| Page | 360 | 390 | 430 | 768 | 820 | 1280 | 1440 | 1920 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / (lands on /login) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /login | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /signup | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /forgot-password | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /reset-password | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /terms | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /privacy | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /ca/invalid-token-for-sweep | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| /this-page-does-not-exist (404) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## Visual inspection

Key screenshots were opened and inspected by eye: login at 360 and 1920, signup at 360, terms at 360, the CA invalid token page at 430, and the 404 page at 768.

- Login (360 and 1920): logo top left, theme toggle top right, centred heading, card and footer all aligned; the card is centred and comfortably inset at both extremes.
- Signup (360): form fields full width inside the card, labels and the optional marker aligned, no clipping.
- Terms (360): text wraps cleanly inside the content column, headings and numbered sections aligned left, nothing runs off the right edge.
- CA invalid token (430): the "Link nahi mila" card is centred with even margins on both sides.
- 404 (768): heading, reassurance text and button centred; the display font uses tight line height by design, consistent with the auth page headings.

No visual misalignment was found on any inspected screenshot, so no CSS or layout fixes were needed and no source files were changed in the main tree for this task.

## Build route table and First Load JS

The full route table from `npm run build` is reproduced in the Stage 5 sweep report held by the parent agent. One important note for the performance pass: Next.js 16.2.7 no longer prints Size or First Load JS columns in the build route table. This was verified in both the default Turbopack build and a `--webpack` build of the same tree; both print routes with only the static or dynamic marker.

To still give the performance pass per route numbers, First Load JS was computed from the webpack build manifests (build-manifest.json rootMainFiles plus the union of client module chunks in each route's client-reference manifest, gzip level 9). This is an upper bound: it counts every client chunk referenced by a route, including a few that may load lazily.

- Shared by all routes (rootMainFiles): 416.7 KiB raw, 122.4 KiB gzip.
- Baseline route total (most routes, including all auth pages, /terms, /privacy, /ca/[token], and the lighter dashboard pages): 1015.0 KiB raw, 296.3 KiB gzip.
- Heavier routes (total gzip): /analytics 400.9 KiB, /invoices/new 369.8 KiB, /quotations/new 360.6 KiB, /pos 343.1 KiB, /catalog 338.9 KiB, /onboarding 338.6 KiB, /dashboard 336.8 KiB, /invoices/[id] 316.7 KiB, /quotations/[id] 308.1 KiB, /settings and its subpages 303.2 KiB, /inventory 302.9 KiB, /print/invoice/[id] 302.1 KiB, /udhaar 299.5 KiB.

## Dashboard pages: not swept here

Authenticated dashboard pages could not be swept because they require a live Supabase session; they were swept in Stage 3 at 360/768/1280 only for the shell, and full authenticated sweep remains blocked on the live Supabase run.

## Artefacts

- Screenshots: 72 full page PNG files (one per page per width) in /tmp/bd-sweep-shots/<page>/<width>.png, about 4.0 MB in total. This directory is in /tmp, so it is ephemeral and will not survive a VM restart or cleanup.
- Raw measurements: /tmp/bd-sweep-results.json (also in /tmp, ephemeral), with per check status, final URL, title, scrollWidth, body scrollWidth and innerWidth values.
- This document is the only file written into the main repository tree by this task, and it was left uncommitted for the parent to commit.
