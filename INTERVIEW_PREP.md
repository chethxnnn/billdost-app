# 🚀 BillDost: Complete Technical Architecture & Interview Guide

This document is a comprehensive breakdown of the **BillDost** platform. It details all architectural decisions, core features, engineering challenges, bug fixes, and interview-ready Q&As for technical discussions, system design interviews, and code walkthroughs.

---

## 1. Product Overview

**What is BillDost?**  
BillDost is a high-velocity, mobile-first, multi-tenant billing & ERP platform tailored for local Indian retail businesses (Hardware, Jewellery, Cloth, and Provision stores). It digitizes storefront operations with instant invoice creation, inventory tracking, quotation-to-bill conversion, and 1-click automated WhatsApp bill delivery.

**Core Problem Solved:**  
Traditional retail software (e.g. legacy desktop Tally or manual ledger books) is clunky, expensive, bound to desktop hardware, and completely disconnected from modern customer communication channels. BillDost operates in-browser on mobile and desktop, requires zero installation, and sends official PDF receipts directly into customers' WhatsApp chats.

---

## 2. Tech Stack & Engineering Rationale

| Layer | Technology | Key Engineering Rationale |
|---|---|---|
| **Frontend Framework** | **Next.js 15+ (App Router)** | Full SSR for instant page loads, nested layout caching for dashboard speed, and unified Server Actions. |
| **Type-Safe API** | **tRPC v11 + TanStack Query** | End-to-end static type safety without GraphQL codegen. Any database or schema change immediately flags typescript compile errors in frontend UI components. |
| **Database & Auth** | **Supabase (PostgreSQL 15)** | Relational integrity with **Row Level Security (RLS)** for physical tenant isolation at the database layer. |
| **Styling & Design** | **Tailwind CSS v4 + shadcn/ui** | Rapid, design-tokenized styling with zero runtime CSS overhead. |
| **Forms & Validation** | **React Hook Form + Zod** | Shared schemas between client validation and tRPC backend mutations. |
| **Client-Side PDF** | **`html2canvas-pro` + `jsPDF`** | Generates dynamic, category-themed invoices directly in the client's browser, eliminating expensive server-side headless browser rendering costs. |
| **WhatsApp Service** | **Node.js + Express + `whatsapp-web.js`** | Continuous headless Chromium microservice linking via QR code, bypassing per-message WhatsApp Business API fees (~₹0.80/message). |

---

## 3. System Architecture & Workflows

### A. True Multi-Tenancy via Row Level Security (RLS)
Instead of error-prone application-layer filtering (`WHERE shop_id = ?`), BillDost enforces isolation directly in PostgreSQL:
- Every table (`invoices`, `customers`, `products`, `activity_log`) carries a `shop_id` foreign key.
- Supabase JWT tokens encode the user's `auth.uid()`.
- RLS policies query the `shop_staff` mapping table. Queries physically cannot return rows belonging to another shop, preventing catastrophic cross-tenant leaks.

### B. Automated 3-Tier WhatsApp Delivery Pipeline
When an invoice is issued, the app dispatches the receipt through a resilient 3-tier cascade:
1. **Tier 1 (Automated Background Send):** Next.js renders the invoice DOM element to high-res canvas via `html2canvas-pro`, converts it to Base64 PDF with `jsPDF`, and POSTs it to the `whatsapp-service`. The microservice sends the PDF document + text directly to the customer's phone in the background.
2. **Tier 2 (Native Web Share):** If the microservice is offline or unlinked, the app invokes `navigator.share({ files: [pdfFile] })` (native on Android/iOS/Windows).
3. **Tier 3 (Web Fallback):** If native sharing is unsupported, it falls back to a formatted `wa.me/91...?text=...` deep link.

### C. Client-Side High-Res PDF Engine
Server-side PDF generation (e.g., Puppeteer cluster) is cost-prohibitive for small SaaS. BillDost renders invoices using React components styled according to the shop's domain (e.g. Cornsilk & serif fonts for Jewellery, dark utilitarian slate for Hardware), captures them at `scale: 2` for razor-sharp printing, and generates standard A4/thermal dimensions in pure JavaScript.

---

## 4. Key Technical Challenges & Solutions (Interview Gold)

> [!TIP]
> Use these deep-dive engineering stories when an interviewer asks: *"Tell me about a complex technical problem you diagnosed and solved."*

### Challenge 1: WhatsApp Session Persistence vs. Serverless Infrastructure
- **Problem:** Running `whatsapp-web.js` inside Next.js serverless functions (Vercel) caused sessions to die after 10-15 seconds due to serverless execution timeouts.
- **Solution:** Decoupled WhatsApp into a standalone, continuous Node.js container (`whatsapp-service`) running on Docker/Railway. Added boot-time session recovery that scans `.wwebjs_auth` on startup so authenticated sessions reconnect immediately after restarts without prompting shopkeepers to re-scan QR codes.

### Challenge 2: Tailwind v4 Modern Color Spaces Breaking Canvas Parsers (`lab()` / `oklch()`)
- **Problem:** Invoices generated with Tailwind CSS v4 crashed during canvas capture with:  
  `Error: Attempting to parse an unsupported color function "lab"`.  
  The legacy `html2canvas` library only recognizes legacy formats (`rgb`, `hex`, `hsl`).
- **Solution:** Upgraded to `html2canvas-pro`, an actively maintained fork engineered specifically to parse modern CSS Color Module 4 functions (`lab()`, `lch()`, `oklch()`), resolving the capture crash with zero UI degradation.

### Challenge 3: WhatsApp Web Upstream Memoization Bug in Media Uploads
- **Problem:** When sending PDF invoices, `sendMessage` crashed with:  
  `Error: Data passed to getter must include an id property (it's how we memoize) but got undefined`.  
  Text messages succeeded, but media failed completely.
- **Root Cause Analysis:** In `whatsapp-web.js/src/util/Injected/Utils.js`, outgoing message payloads spread `mediaOptions` *after* `id: newMsgKey`. Because `mediaOptions` contained an undefined `id`, it clobbered the message's primary key ID before reaching WhatsApp Web's internal getter.
- **Solution:** 
  1. Patched `Utils.js` to ensure `message.id = newMsgKey` is placed *after* all media metadata options are spread.
  2. Enforced `{ sendMediaAsDocument: true }` so WhatsApp Web handles the payload as an official PDF document.
  3. Created an automated `patch-wwebjs.js` postinstall script to ensure dependency reinstalls permanently retain the fix.
  4. Added a fallback in the microservice controller that dispatches the bill summary as a direct text message if network drops interrupt media uploads.

### Challenge 4: Regional Telecom Phone Number Normalization
- **Problem:** Shopkeepers frequently type 10-digit local mobile numbers (e.g. `9876543210`). Passing this to WhatsApp Web as `9876543210@c.us` failed delivery because WhatsApp's protocol requires the international dialing code.
- **Solution:** Implemented regex sanitization in `index.js` that strips non-digit characters and automatically prefixes Indian country code `91` (`919876543210@c.us`) whenever a 10-digit number is provided.

---

## 5. High-Frequency Interview Questions & Master Answers

### Q1: Why did you choose Row Level Security (RLS) over application-level `WHERE shop_id = ?` filtering?
**A:** *"I chose RLS for defense in depth and zero-trust tenant isolation. Relying on application-level filtering is fragile: if a developer forgets a `WHERE shop_id = ?` clause on a single new endpoint or report query, financial data from one shop can leak to another. With PostgreSQL RLS, the database engine itself enforces the constraint on every query based on the authenticated JWT `auth.uid()`. Even if an API endpoint executes `SELECT * FROM invoices`, PostgreSQL physically restricts the returned dataset to rows the authenticated user is authorized to view."*

### Q2: How does Role-Based Access Control (RBAC) work between Shop Owners and Cashiers?
**A:** *"We use a two-tier model: UX routing and database policy enforcement. At the UI layer, staff roles (`owner` vs. `cashier`) dictate sidebar navigation and page access—cashiers cannot view Analytics, Settings, or Profit Margins. At the database layer, RLS policies grant cashiers `INSERT` and `SELECT` rights on invoices and customers (to bill customers), but strictly prohibit `DELETE` or `UPDATE` on historic financial records. Even if a cashier attempts to bypass the UI and hit the API directly, Postgres denies the transaction."*

### Q3: Why tRPC instead of GraphQL or standard REST?
**A:** *"For a fast-moving full-stack TypeScript application, tRPC provides unmatched velocity. GraphQL introduces significant boilerplate—separate schema definitions, resolvers, and codegen pipelines. REST requires manual typing of client responses or OpenAPI generators. tRPC infers types directly from the router definitions. If I alter an invoice table column or mutation signature on the backend, TypeScript immediately flags the impacted frontend components at build time."*

### Q4: If this platform scales to 100,000 shops, what is your architectural roadmap?
**A:** 
1. **WhatsApp Microservice Horizontal Sharding:** The primary resource bottleneck is headless Chromium memory. We would shard the microservice into a container pool managed by Kubernetes, using Redis session affinity or hash rings on `shop_id` so each shop routes to its dedicated container. For enterprise tiers with millions of messages, we would offer an opt-in toggle to the Official Meta Cloud API.
2. **Database Read Replicas & Connection Pooling:** Implement Supabase connection pooling (Supavisor) with dedicated read replicas for analytical queries (dashboard charts, sales aggregations), keeping the primary database unburdened for OLTP invoice creation.
3. **Queue-Backed Messaging:** Decouple WhatsApp dispatching using a message queue (BullMQ + Redis) with exponential backoff and retry mechanisms to handle intermittent carrier connectivity.
