---
name: billdost
description: >
  Full product context for BillDost — a WhatsApp-first billing app for Indian shopkeepers
  built by Chethan (chethxnnn). Use this skill automatically whenever the user mentions
  BillDost, billdost.in, billing app, invoice, WhatsApp billing, kirana, dhaba, shopkeeper
  app, or any feature, schema, route, component, or decision related to this project.
  This skill must trigger for ANY question about the BillDost codebase — architecture,
  database schema, tRPC routes, onboarding flow, invoice templates, GST, UPI, WhatsApp
  integration, Supabase, Vercel, Razorpay, Gupshup, multi-language, PWA, staff roles,
  analytics, CSV import, deployment, or roadmap. When in doubt, load this skill.
---

# BillDost — Complete Product Architecture & Build Plan

> **Version:** 1.0
> **Date:** 18 May 2026
> **Author:** BillDost Engineering
> **Status:** Pre-Development Planning
> **Owner:** chethxnnn (Chethan)
> **Domain:** billdost.in
> **Landing:** LIVE on Vercel (billdost.vercel.app + billdost.in)

---

## How Claude Should Use This Skill

- This is the **single source of truth** for BillDost. Always refer here before answering any question about the project.
- When Chethan says "the app", "our app", "the project", "billdost", "the billing thing" — he means this.
- When he asks about a feature, schema, component, or decision — check this document first.
- When he says something like "add GST to the invoice" or "fix the WhatsApp flow" — you already know the full context from this doc.
- Never ask "what project is this?" or "what tech stack are you using?" — it's all here.
- If something is not in this doc yet, flag it as a new decision and suggest adding it.

---

## Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [Target Users](#2-target-users)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Auth & Security](#6-auth--security)
7. [Onboarding Flow](#7-onboarding-flow)
8. [Core Features](#8-core-features)
9. [Invoice System](#9-invoice-system)
10. [Quotation System](#10-quotation-system)
11. [Payment Handling](#11-payment-handling)
12. [WhatsApp Integration](#12-whatsapp-integration)
13. [Invoice Templates](#13-invoice-templates)
14. [Multi-Language (i18n)](#14-multi-language-i18n)
15. [Theme System](#15-theme-system-darklight)
16. [Mobile-First Design](#16-mobile-first-design)
17. [Analytics Dashboard](#17-analytics-dashboard)
18. [CSV Import](#18-csv-import)
19. [Staff & Roles](#19-staff--roles)
20. [Phased Build Plan](#20-phased-build-plan)
21. [API Routes (tRPC)](#21-api-routes-trpc)
22. [Third-Party Accounts Needed](#22-third-party-accounts-needed)
23. [Environment Variables](#23-environment-variables)
24. [Deployment Checklist](#24-deployment-checklist)
25. [Future Roadmap (Post-MVP)](#25-future-roadmap-post-mvp)
26. [Key Decisions Pending](#26-key-decisions-pending)
27. [Contact & Resources](#27-contact--resources)

---

## 1. Product Philosophy

BillDost is NOT an accounting tool. It is a **WhatsApp-first billing companion** for Indian shopkeepers who have never used software before.

### Core principles

- **Mobile-first, desktop-capable** — 80%+ users will be on Android phones (often budget phones)
- **Onboarding must feel like a WhatsApp conversation**, not a software setup wizard
- **Every screen must pass the "dhaba owner test"** — if a dhaba owner in a Tier 3 city can't figure it out in 10 seconds without reading instructions, redesign it
- **Hinglish is the default voice** — not formal Hindi, not formal English. The way people actually talk
- **Offline-capable for critical flows** — invoice creation must work without internet, sync when back online
- **Data belongs to the user** — export everything, delete everything, no lock-in
- **Speed over features** — ship fewer features that work perfectly, rather than many that work poorly

---

## 2. Target Users

| Segment | Examples | Key Need |
|---|---|---|
| Kirana Stores | Grocery, general stores | Quick billing for 50+ daily items |
| Dhabas & Restaurants | Small eateries, tiffin services | Table-wise billing, food items |
| Salons & Parlours | Hair salons, beauty parlours | Service-based billing |
| Repair Shops | Mobile repair, electrical | Job card + invoice |
| Wholesale Traders | Bulk suppliers | Large invoices, GST compliance |
| Medical Stores | Pharmacies | HSN codes, batch tracking |

### User profile

- Age: 25-55
- Tech comfort: Low to medium (WhatsApp expert, app novice)
- Device: Android phone, ₹8K-20K budget phone
- Language: Hindi/Hinglish primary, some Kannada (Bengaluru market), English minority
- Current billing: Handwritten notebooks, torn paper, or no billing at all
- Key motivation: "Professional dikhna hai" (want to look professional)

---

## 3. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14+ (App Router) | SSR for landing, SPA for dashboard, API routes |
| TypeScript | 5.x | Type safety across entire codebase |
| Tailwind CSS | 3.x | Styling (consistent with landing page) |
| shadcn/ui | Latest | Accessible, customizable UI components |
| Framer Motion | 11.x | Animations (consistent with landing) |
| next-intl | Latest | Multi-language (EN/HI/KN/Hinglish) |
| next-themes | Latest | Dark/light mode with zero flash |
| React Hook Form | 7.x | Complex form handling (invoice builder) |
| Zod | 3.x | Schema validation (forms + API) |
| TanStack Query | 5.x | Server state, caching, offline support |
| jsPDF + html2canvas | Latest | Client-side PDF generation |
| qrcode.react | Latest | UPI QR code generation |

### Backend

| Technology | Purpose |
|---|---|
| Next.js API Routes | Server endpoints |
| tRPC | Type-safe API layer (end-to-end TypeScript) |
| Supabase Client | Database queries, auth, storage |

### Database & Services

| Service | Purpose | Tier |
|---|---|---|
| Supabase | Postgres DB + Auth (phone OTP) + Storage (logos, PDFs) + Realtime | Free (500MB DB, 1GB storage, 50K auth users) |
| Vercel | Frontend hosting + API routes + Edge functions | Free (Hobby) |
| Gupshup or AiSensy | WhatsApp Business API (send invoices) | Pay-per-message (~₹0.30-0.50/msg) |
| Razorpay | Subscription billing + UPI payments | 2% transaction fee |

### Why NOT these alternatives

| Rejected | Reason |
|---|---|
| Firebase/Firestore | NoSQL = pain for relational invoice data, no proper SQL joins |
| MongoDB | Same — invoices are inherently relational (invoice → items → customer) |
| Express/FastAPI separate backend | Unnecessary complexity for MVP, Next.js API routes + tRPC is faster to build |
| AWS | Overkill for MVP, expensive, complex — migrate at 10K+ users if needed |
| Flutter/React Native mobile app | PWA first — no App Store delays, instant updates, works on low-end phones |
| Prisma ORM | Supabase client + raw SQL is faster and gives more control over RLS |

---

## 4. Project Structure

```
billdost/
├── public/
│   ├── locales/                    # i18n translation JSON files
│   │   ├── en/
│   │   │   ├── common.json        # Shared strings
│   │   │   ├── dashboard.json     # Dashboard-specific
│   │   │   ├── invoice.json       # Invoice builder
│   │   │   ├── onboarding.json    # Setup wizard
│   │   │   └── settings.json
│   │   ├── hi/                    # Hindi translations
│   │   ├── kn/                    # Kannada translations
│   │   └── hinglish/              # Hinglish translations
│   ├── invoice-templates/          # SVG/HTML template previews
│   ├── default-catalogs/           # JSON default product lists per shop type
│   │   ├── kirana.json
│   │   ├── dhaba.json
│   │   ├── salon.json
│   │   ├── repair.json
│   │   ├── wholesale.json
│   │   └── medical.json
│   └── icons/                      # PWA icons, favicon
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   │
│   │   ├── (landing)/              # LANDING PAGE (existing, migrated from Vite)
│   │   │   ├── page.tsx            # Home page
│   │   │   ├── layout.tsx          # Landing layout (no sidebar)
│   │   │   ├── privacy/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   ├── refund-policy/page.tsx
│   │   │   └── dpdp-compliance/page.tsx
│   │   │
│   │   ├── (auth)/                 # AUTH PAGES (outside dashboard layout)
│   │   │   ├── layout.tsx          # Minimal auth layout
│   │   │   ├── login/page.tsx      # Phone OTP login
│   │   │   ├── signup/page.tsx     # Phone OTP signup
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── onboarding/        # MULTI-STEP SETUP WIZARD
│   │   │       ├── page.tsx        # Wizard container
│   │   │       └── steps/
│   │   │           ├── BusinessInfo.tsx      # Step 1: Shop name, logo
│   │   │           ├── ShopCategory.tsx      # Step 2: Type of shop
│   │   │           ├── GSTSetup.tsx          # Step 3: GSTIN (optional)
│   │   │           ├── CatalogSetup.tsx      # Step 4: Default products
│   │   │           ├── UPISetup.tsx          # Step 5: UPI ID, QR upload
│   │   │           ├── LanguageSetup.tsx     # Step 6: Choose language
│   │   │           ├── StaffSetup.tsx        # Step 7: Admin PIN, staff
│   │   │           └── Complete.tsx          # Step 8: Summary + confetti
│   │   │
│   │   ├── (dashboard)/            # PROTECTED DASHBOARD (requires auth)
│   │   │   ├── layout.tsx          # Sidebar + topbar + theme + i18n provider
│   │   │   ├── page.tsx            # Redirects to /dashboard
│   │   │   ├── dashboard/page.tsx  # Dashboard home (stats, activity, recent bills)
│   │   │   │
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx        # All invoices list + filters + search
│   │   │   │   ├── new/page.tsx    # Invoice builder (form + live preview)
│   │   │   │   └── [id]/page.tsx   # Single invoice detail view
│   │   │   │
│   │   │   ├── quotations/
│   │   │   │   ├── page.tsx        # All quotations list
│   │   │   │   ├── new/page.tsx    # Quotation builder
│   │   │   │   └── [id]/page.tsx   # Single quotation + "Convert to Invoice" button
│   │   │   │
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx        # Customer list + cards
│   │   │   │   ├── [id]/page.tsx   # Customer profile (history, stats)
│   │   │   │   └── import/page.tsx # CSV upload page
│   │   │   │
│   │   │   ├── catalog/
│   │   │   │   └── page.tsx        # Products/services CRUD
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx        # Charts, GST summary, top customers
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx        # Settings overview
│   │   │       ├── profile/page.tsx     # Shop details, logo
│   │   │       ├── staff/page.tsx       # Staff management
│   │   │       ├── templates/page.tsx   # Invoice template picker
│   │   │       ├── whatsapp/page.tsx    # WhatsApp connection
│   │   │       ├── upi/page.tsx         # UPI settings
│   │   │       ├── language/page.tsx    # Language preference
│   │   │       └── billing/page.tsx     # Subscription plan (Razorpay)
│   │   │
│   │   └── api/                    # API ROUTES
│   │       ├── trpc/[trpc]/route.ts    # tRPC handler
│   │       ├── webhooks/
│   │       │   ├── razorpay/route.ts   # Payment webhooks
│   │       │   └── whatsapp/route.ts   # Delivery status callbacks
│   │       └── cron/
│   │           └── reminders/route.ts  # Scheduled payment reminders
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── sheet.tsx           # Mobile slide-out panels
│   │   │   └── skeleton.tsx
│   │   │
│   │   ├── dashboard/              # Dashboard-specific components
│   │   │   ├── Sidebar.tsx         # Collapsible sidebar (desktop)
│   │   │   ├── BottomNav.tsx       # Bottom navigation (mobile)
│   │   │   ├── Topbar.tsx          # Top bar with shop name, actions
│   │   │   ├── StatCard.tsx        # Revenue, bills, customers cards
│   │   │   ├── ActivityFeed.tsx    # Live activity feed
│   │   │   ├── MiniBarChart.tsx    # Small inline charts
│   │   │   ├── InvoiceBuilder.tsx  # Invoice creation form
│   │   │   ├── InvoicePreview.tsx  # Live invoice preview panel
│   │   │   ├── QuotationBuilder.tsx
│   │   │   ├── CustomerPicker.tsx  # Searchable customer dropdown
│   │   │   ├── ProductPicker.tsx   # Searchable product dropdown
│   │   │   ├── CSVImporter.tsx     # CSV upload + mapping UI
│   │   │   ├── TemplateSelector.tsx # Visual template picker (4 options)
│   │   │   ├── PaymentModeSelector.tsx  # Cash/UPI/Pending toggle
│   │   │   └── UPIQRGenerator.tsx  # QR code component
│   │   │
│   │   ├── landing/                # Existing landing components (migrated from Vite)
│   │   │   ├── Hero.tsx
│   │   │   ├── Nav.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── Pricing.tsx
│   │   │   └── ... (all existing components)
│   │   │
│   │   └── shared/                 # Shared across landing + dashboard
│   │       ├── ThemeToggle.tsx
│   │       ├── LanguageSwitcher.tsx
│   │       ├── WhatsAppIcon.tsx
│   │       ├── Logo.tsx
│   │       └── LoadingSpinner.tsx
│   │
│   ├── server/                     # SERVER-SIDE LOGIC (tRPC routers)
│   │   ├── trpc.ts                 # tRPC initialization + context
│   │   ├── routers/
│   │   │   ├── _app.ts            # Root router (merges all sub-routers)
│   │   │   ├── auth.ts            # Login, signup, verify OTP, reset password
│   │   │   ├── shop.ts            # Shop CRUD, onboarding, settings
│   │   │   ├── invoices.ts        # Invoice CRUD, send, mark paid
│   │   │   ├── quotations.ts      # Quotation CRUD, convert to invoice
│   │   │   ├── customers.ts       # Customer CRUD, CSV import, search
│   │   │   ├── products.ts        # Product CRUD, stock management
│   │   │   ├── analytics.ts       # Revenue, GST, customer insights
│   │   │   ├── whatsapp.ts        # Send message, check status
│   │   │   ├── payments.ts        # Record payment, Razorpay integration
│   │   │   └── staff.ts           # Staff invite, role management
│   │   │
│   │   └── services/               # Business logic (used by routers)
│   │       ├── pdf.ts              # Invoice/quotation PDF generation
│   │       ├── whatsapp.ts         # BSP API wrapper (Gupshup/AiSensy)
│   │       ├── upi.ts             # UPI QR code generation
│   │       ├── csv-parser.ts       # CSV file parsing + validation
│   │       ├── invoice-number.ts   # Auto-increment invoice numbers
│   │       ├── gst-calculator.ts   # CGST/SGST/IGST calculation
│   │       ├── reminders.ts        # Payment reminder scheduling
│   │       └── stock.ts            # Stock deduction on invoice creation
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   └── middleware.ts       # Auth middleware for protected routes
│   │   ├── trpc/
│   │   │   ├── client.ts          # tRPC React client
│   │   │   └── server.ts          # tRPC server caller
│   │   ├── utils.ts               # Formatting helpers (₹, dates, etc.)
│   │   ├── constants.ts           # App-wide constants
│   │   ├── i18n.ts                # i18n configuration
│   │   └── invoice-templates/      # Template React components
│   │       ├── classic.tsx
│   │       ├── modern.tsx
│   │       ├── minimal.tsx
│   │       └── branded.tsx
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useShop.ts             # Current shop context
│   │   ├── useInvoice.ts          # Invoice builder state
│   │   ├── useCustomers.ts        # Customer list + search
│   │   ├── useProducts.ts         # Product catalog + search
│   │   ├── useAnalytics.ts        # Dashboard data
│   │   ├── useOffline.ts          # Offline detection + queue
│   │   └── useTheme.ts            # Theme preference
│   │
│   ├── stores/                     # Client state (Zustand or context)
│   │   ├── invoice-store.ts       # Invoice builder local state
│   │   └── app-store.ts           # Sidebar collapse, mobile menu, etc.
│   │
│   └── types/
│       ├── database.ts            # Auto-generated from Supabase schema
│       ├── invoice.ts             # Invoice-specific types
│       ├── shop.ts                # Shop types
│       └── api.ts                 # API request/response types
│
├── supabase/
│   ├── migrations/                 # SQL migration files (versioned)
│   │   ├── 001_shops.sql
│   │   ├── 002_customers.sql
│   │   ├── 003_products.sql
│   │   ├── 004_invoices.sql
│   │   ├── 005_quotations.sql
│   │   ├── 006_payments.sql
│   │   ├── 007_staff.sql
│   │   ├── 008_activity_log.sql
│   │   └── 009_rls_policies.sql
│   ├── seed.sql                    # Demo data for development/testing
│   └── config.toml                 # Supabase local dev config
│
├── .env.local                      # Local environment variables (NEVER commit)
├── .env.example                    # Template for env vars
├── tailwind.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── vercel.json
├── middleware.ts                    # Next.js middleware (auth redirect, i18n)
└── README.md
```

---

## 5. Database Schema

### 5.1 Shops

```sql
CREATE TABLE shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  category        TEXT NOT NULL,
  -- Category values: 'kirana', 'dhaba', 'salon', 'repair', 'wholesale', 'medical', 'other'
  logo_url        TEXT,
  phone           TEXT NOT NULL,
  whatsapp        TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT DEFAULT 'Karnataka',
  pincode         TEXT,
  gstin           TEXT,
  upi_id          TEXT,
  upi_qr_url      TEXT,
  currency        TEXT DEFAULT 'INR',
  language        TEXT DEFAULT 'hinglish',
  -- Language values: 'en', 'hi', 'kn', 'hinglish'
  theme           TEXT DEFAULT 'dark',
  -- Theme values: 'dark', 'light'
  invoice_prefix  TEXT DEFAULT 'INV',
  invoice_counter INT DEFAULT 1000,
  quotation_prefix TEXT DEFAULT 'QT',
  quotation_counter INT DEFAULT 100,
  active_template TEXT DEFAULT 'classic',
  -- Template values: 'classic', 'modern', 'minimal', 'branded'
  include_upi_qr_default BOOLEAN DEFAULT TRUE,
  onboarding_done BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'free',
  -- Tier values: 'free', 'standard', 'pro'
  subscription_id TEXT,
  subscription_expires_at TIMESTAMPTZ,
  wa_connected    BOOLEAN DEFAULT FALSE,
  wa_phone_id     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Staff

```sql
CREATE TABLE staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'billing',
  -- Role values: 'admin', 'billing', 'viewer'
  -- admin: full access
  -- billing: create invoices, manage customers/products, NO settings
  -- viewer: read-only dashboard + analytics
  pin         TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  joined_at   TIMESTAMPTZ
);
```

### 5.3 Customers

```sql
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  whatsapp    TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  tags        TEXT[],
  -- Tag examples: ['vip', 'regular', 'new', 'overdue']
  total_billed NUMERIC(12,2) DEFAULT 0,
  total_paid   NUMERIC(12,2) DEFAULT 0,
  bill_count   INT DEFAULT 0,
  last_billed  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, phone)
);
```

### 5.4 Products / Catalog

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  hsn_code        TEXT,
  unit            TEXT DEFAULT 'piece',
  -- Unit values: 'piece', 'kg', 'g', 'litre', 'ml', 'dozen', 'pack', 'service', 'hour'
  price           NUMERIC(10,2) NOT NULL,
  cost_price      NUMERIC(10,2),
  tax_rate        NUMERIC(4,2) DEFAULT 0,
  stock_qty       NUMERIC(10,2),
  low_stock_alert NUMERIC(10,2),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.5 Invoices

```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  quotation_id    UUID REFERENCES quotations(id),

  invoice_number  TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'invoice',
  -- Type values: 'invoice', 'credit_note'

  -- Customer snapshot (denormalized — customer details may change later)
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  customer_address TEXT,

  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,

  -- Calculated amounts (stored for fast queries)
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_amt    NUMERIC(12,2) DEFAULT 0,
  taxable_amt     NUMERIC(12,2) DEFAULT 0,
  cgst_amt        NUMERIC(12,2) DEFAULT 0,
  sgst_amt        NUMERIC(12,2) DEFAULT 0,
  igst_amt        NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(12,2) DEFAULT 0,
  balance_due     NUMERIC(12,2) DEFAULT 0,

  -- Payment
  payment_status  TEXT DEFAULT 'unpaid',
  -- Status values: 'unpaid', 'partial', 'paid'
  payment_mode    TEXT,
  -- Mode values: 'cash', 'upi', 'bank', 'mixed', NULL (if unpaid)
  paid_at         TIMESTAMPTZ,
  include_upi_qr  BOOLEAN DEFAULT TRUE,

  -- WhatsApp delivery tracking
  wa_status       TEXT DEFAULT 'draft',
  -- WA status values: 'draft', 'queued', 'sent', 'delivered', 'read', 'failed'
  wa_message_id   TEXT,
  wa_sent_at      TIMESTAMPTZ,
  wa_delivered_at TIMESTAMPTZ,
  wa_read_at      TIMESTAMPTZ,

  -- PDF
  pdf_url         TEXT,
  template_used   TEXT DEFAULT 'classic',

  notes           TEXT,
  internal_notes  TEXT,

  created_by      UUID REFERENCES staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.6 Invoice Line Items

```sql
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  name        TEXT NOT NULL,
  description TEXT,
  hsn_code    TEXT,
  unit        TEXT DEFAULT 'piece',
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2) NOT NULL,
  tax_rate    NUMERIC(4,2) DEFAULT 0,
  tax_amt     NUMERIC(10,2) DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL,
  sort_order  INT DEFAULT 0
);
```

### 5.7 Quotations

```sql
CREATE TABLE quotations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id),
  quotation_number    TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,

  subtotal            NUMERIC(12,2) DEFAULT 0,
  discount_pct        NUMERIC(5,2) DEFAULT 0,
  discount_amt        NUMERIC(12,2) DEFAULT 0,
  tax_amt             NUMERIC(12,2) DEFAULT 0,
  total               NUMERIC(12,2) DEFAULT 0,

  status              TEXT DEFAULT 'draft',
  -- Status values: 'draft', 'sent', 'accepted', 'rejected', 'converted'
  converted_invoice_id UUID REFERENCES invoices(id),
  valid_until         DATE,
  notes               TEXT,
  pdf_url             TEXT,

  wa_status           TEXT DEFAULT 'draft',
  wa_sent_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.8 Quotation Line Items

```sql
CREATE TABLE quotation_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  name          TEXT NOT NULL,
  unit          TEXT DEFAULT 'piece',
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,
  total         NUMERIC(12,2) NOT NULL,
  sort_order    INT DEFAULT 0
);
```

### 5.9 Payments Log

```sql
CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  invoice_id  UUID NOT NULL REFERENCES invoices(id),
  amount      NUMERIC(12,2) NOT NULL,
  mode        TEXT NOT NULL,
  -- Mode values: 'cash', 'upi', 'bank', 'cheque'
  reference   TEXT,
  notes       TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES staff(id)
);
```

### 5.10 Activity Log

```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES staff(id),
  type        TEXT NOT NULL,
  -- Type values: 'invoice_created', 'invoice_sent', 'invoice_paid',
  --   'quotation_created', 'quotation_sent', 'quotation_converted',
  --   'customer_added', 'payment_received', 'stock_low',
  --   'staff_invited', 'settings_changed'
  entity_type TEXT,
  -- Entity values: 'invoice', 'quotation', 'customer', 'product', 'payment'
  entity_id   UUID,
  summary     TEXT NOT NULL,
  -- Human-readable, e.g.: "Ramesh Kumar ko ₹2,340 ka bill bheja"
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.11 Indexes

```sql
CREATE INDEX idx_invoices_shop ON invoices(shop_id, created_at DESC);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(shop_id, payment_status);
CREATE INDEX idx_invoices_number ON invoices(shop_id, invoice_number);
CREATE INDEX idx_customers_shop ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(shop_id, phone);
CREATE INDEX idx_customers_name ON customers(shop_id, name);
CREATE INDEX idx_products_shop ON products(shop_id, is_active);
CREATE INDEX idx_products_name ON products(shop_id, name);
CREATE INDEX idx_activity_shop ON activity_log(shop_id, created_at DESC);
CREATE INDEX idx_quotations_shop ON quotations(shop_id, created_at DESC);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_staff_shop ON staff(shop_id);
```

### 5.12 Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Example policy: shop owner can see only their shop's data
CREATE POLICY "Shop owners can view their own shop"
  ON shops FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view their shop's customers"
  ON customers FOR SELECT
  USING (shop_id IN (
    SELECT id FROM shops WHERE owner_id = auth.uid()
    UNION
    SELECT shop_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- Similar policies for ALL tables
-- Each table filtered by shop_id linked to the authenticated user
```

---

## 6. Auth & Security

### Auth flow

1. **Signup:** Phone number → OTP via SMS (Supabase Auth with Twilio) → Create account → Redirect to onboarding
2. **Login:** Phone number → OTP → Dashboard
3. **Quick PIN:** 4-digit PIN for returning users (stored locally, validated server-side)
4. **Forgot password:** Phone OTP re-verification → Reset PIN
5. **Staff login:** Phone OTP → Dashboard with limited access based on role

### Security layers

| Layer | Implementation |
|---|---|
| Authentication | Supabase Auth (phone OTP), JWT tokens, auto-refresh |
| Authorization | Row Level Security (RLS) at database level |
| API protection | tRPC middleware validates session on every call |
| Data encryption | AES-256 at rest (Supabase), TLS 1.3 in transit |
| Secrets | Vercel environment variables (never committed to git) |
| CSRF protection | Built into Next.js |
| Rate limiting | Vercel edge middleware (login attempts, API calls) |
| Input validation | Zod schemas on every form + every API endpoint |
| File upload security | Supabase Storage with size limits (2MB logo, 5MB CSV), type validation |
| XSS prevention | React auto-escapes, no dangerouslySetInnerHTML |

---

## 7. Onboarding Flow

**Triggered after first signup. 8 steps, ~3 minutes total.**

### Step 1: Business Info

```
Screen title: "Aapki dukaan ka naam kya hai?"
Fields:
  - Business name (required, text)
  - Upload logo (optional, image picker)
  - Fallback: "Logo nahi hai? Koi baat nahi, hum naam se bana denge"
UI: Large input, friendly tone, skip button for logo
```

### Step 2: Shop Category

```
Screen title: "Aapki dukaan kis type ki hai?"
Options (visual cards with icons — reuse landing page LogosBar icons):
  - 🛒 Kirana Store
  - 🍛 Dhaba / Restaurant
  - ✂️ Salon / Parlour
  - 🔧 Repair Shop
  - 🏪 Wholesale / Distributor
  - 💊 Medical Store
  - 📦 Other
Effect: Auto-loads default product catalog for selected type
```

### Step 3: GST Setup

```
Screen title: "GST registered ho?"
Toggle: Yes / No (big, prominent)
If yes:
  - GSTIN input (auto-validate 15-char format)
  - "Aapka GSTIN verify ho gaya ✅" or "Format galat hai"
If no:
  - "Koi baat nahi, baad mein add kar sakte ho"
  - Skip to next step
```

### Step 4: Catalog Setup

```
Screen title: "Apne products add karo"
Pre-loaded: Default products for the selected shop type (e.g., kirana → Atta, Chai, Dal, etc.)
Actions:
  - Edit any pre-loaded product (name, price, unit)
  - Delete unwanted products
  - Add custom products
  - "CSV se import karo" button (advanced)
  - "Baad mein karenge" skip (prominent)
UI: Editable card grid, not a table (mobile-friendly)
```

### Step 5: UPI Setup

```
Screen title: "Payment setup karo"
Fields:
  - UPI ID input (yourname@bank)
  - OR upload QR code image
  - Toggle: "Har bill mein UPI QR dikhao?" (default: ON)
  - Preview: small mock invoice showing QR placement
Skip: "Abhi nahi, baad mein" (always available)
```

### Step 6: Language

```
Screen title: "Bhasha chuno / Choose language"
Options (4 large visual cards):
  - 🇬🇧 English
  - 🇮🇳 हिन्दी (Hindi)
  - 🇮🇳 Hinglish (English + Hindi mix) ← RECOMMENDED badge
  - 🇮🇳 ಕನ್ನಡ (Kannada)
Effect: All text on the rest of onboarding + dashboard changes immediately
Note: "Baad mein Settings se change kar sakte ho"
```

### Step 7: Admin & Staff

```
Screen title: "Admin account set karo"
Fields:
  - Phone number (pre-filled from signup, read-only)
  - Set 4-digit PIN (for quick login)
  - "Staff add karna hai?" toggle
  - If yes: Add staff name + phone + role (billing/viewer)
  - If no: Skip
```

### Step 8: Complete

```
Screen title: "Sab set hai! 🎉"
Content:
  - Summary card: shop name, category, language, template
  - Confetti animation
  - "Pehla bill banao →" big green CTA button
  - "Dashboard dekho →" secondary button
```

---

## 8. Core Features

### 8.1 Dashboard

- **Stat cards:** Today's revenue, pending payments, bills sent, new customers
- **Weekly revenue chart:** Mini bar chart (Mon-Sun)
- **Recent bills table:** Last 5 invoices with status badges
- **Top selling items:** Progress bar chart
- **Activity feed:** Real-time log of all actions
- **Quick action:** "Naya Bill" floating button (always visible on mobile)

### 8.2 Invoice Builder

- **Customer picker:** Searchable dropdown, "Add new" inline, edit name option
- **Item list:** Add from catalog or type custom, quantity, price, auto-calculate
- **Discount:** Percentage input, auto-applied
- **GST:** Dropdown (0%, 5%, 12%, 18%, 28%), auto-calculate CGST/SGST
- **Payment mode:** Cash (mark paid) / UPI (mark paid) / Send bill (unpaid + QR)
- **Notes:** Optional message on invoice
- **Live preview:** Right panel (desktop) / bottom sheet (mobile) showing invoice PDF
- **Actions:** Send via WhatsApp, Download PDF, Print

### 8.3 All Invoices

- **Tab filters:** All, Paid, Pending, Overdue, Sent
- **Search:** By customer name or invoice number
- **Sort:** By date, amount, status
- **Bulk actions:** Mark multiple as paid, resend WhatsApp
- **Invoice detail page:** Full view, payment history, WhatsApp delivery status

### 8.4 Customers

- **Card grid view** (not table — more visual, mobile-friendly)
- **Each card:** Avatar (initials), name, phone, total billed, bill count, tags
- **WhatsApp button** on each card (open chat)
- **Customer profile page:** Billing history, total spent, frequency
- **CSV import page:** Upload, column mapping, preview, confirm

### 8.5 Product Catalog

- **Card grid view** (emoji + name + price + stock)
- **Categories:** Filter by product category
- **Low stock alerts:** Red badge on items below threshold
- **Quick add to invoice:** "+" button on each product
- **Inline edit:** Click product card → edit drawer slides in

### 8.6 Settings

- **Profile:** Shop name, logo, address, GSTIN
- **Templates:** Visual picker for 4 invoice templates (click to preview, click to select)
- **WhatsApp:** Connection status, test message
- **UPI:** UPI ID, QR upload, default QR toggle
- **Language:** Change dashboard language
- **Staff:** Add/remove staff, change roles
- **Billing:** Current plan, upgrade, payment history

---

## 9. Invoice System

### Creation flow

```
1. Shopkeeper taps "Naya Bill"
2. Select or search customer (or add new inline)
3. Add items:
   a. Search catalog → tap to add
   b. Or type item name + price manually
4. Set quantity for each item
5. Optional: Apply discount %
6. GST auto-calculated based on shop settings
7. Choose payment status:
   - "Already paid — Cash" → No QR, status = paid
   - "Already paid — UPI" → No QR, status = paid
   - "Send bill (pending)" → QR included, status = unpaid
   - "Partial payment" → Enter amount paid, balance + QR
8. Preview invoice (live PDF preview)
9. Send via WhatsApp OR download PDF OR print
```

### Invoice numbering

```
Format: {prefix}-{counter}
Example: INV-1001, INV-1002, INV-1003
- Prefix configurable per shop (default: "INV")
- Counter auto-increments per shop (atomic DB operation)
- Never reuses numbers (even if invoice deleted)
```

### PDF generation

```
Client-side: jsPDF + html2canvas (fast, no server load)
Template selection: Classic, Modern, Minimal, Branded
Content:
  - Shop logo or name
  - Invoice number + date + due date
  - Customer name, phone, address
  - Line items table (item, qty, rate, tax, amount)
  - Subtotal, discount, GST breakdown (CGST+SGST or IGST), total
  - UPI QR code (if enabled + if payment pending)
  - Notes
  - "Powered by BillDost" watermark (free tier only)
```

---

## 10. Quotation System

### Difference from invoice

| Feature | Invoice | Quotation |
|---|---|---|
| Number format | INV-1001 | QT-101 |
| Header label | "TAX INVOICE" | "QUOTATION" |
| UPI QR code | Yes (if pending) | Never |
| Payment tracking | Yes | No |
| GST breakdown | Full (CGST/SGST) | Optional (estimate) |
| Status flow | draft → sent → paid | draft → sent → accepted → converted |
| Validity | Due date | "Valid until" date |
| Watermark | None | "This is not a tax invoice" |

### Conversion flow

```
1. Customer accepts quotation
2. Shopkeeper opens quotation → clicks "Convert to Invoice"
3. All items auto-copied to new invoice
4. Shopkeeper can:
   - Edit items (add/remove/change price)
   - Add GST (may differ from estimate)
   - Choose payment mode
5. Invoice created with link back to original quotation
6. Quotation status changes to "converted"
```

---

## 11. Payment Handling

### At invoice creation time

```
Payment Mode Selector UI:

┌─────────────────────────────────────────────┐
│  How is the customer paying?                │
│                                             │
│  ○ Send bill (payment pending)              │
│    → UPI QR included in PDF                 │
│    → Status: unpaid                         │
│                                             │
│  ○ Already paid — Cash ₹                    │
│    → No QR in PDF                           │
│    → "PAID ✅" stamp on invoice             │
│    → Status: paid, mode: cash               │
│                                             │
│  ○ Already paid — UPI                       │
│    → No QR in PDF                           │
│    → "PAID ✅" stamp on invoice             │
│    → Status: paid, mode: upi               │
│    → Optional: UPI reference number         │
│                                             │
│  ○ Partial payment                          │
│    → Enter amount received: ₹____           │
│    → Balance shown + QR for remaining       │
│    → Status: partial                        │
└─────────────────────────────────────────────┘
```

### After invoice sent

- Dashboard shows payment status badges (Paid ✅, Pending ⏳, Overdue !)
- "Record Payment" button on any pending invoice
- Payment log per invoice (multiple payments for partial)
- Auto-calculate balance due

---

## 12. WhatsApp Integration

### Phase 1: Simple (BSP via Gupshup or AiSensy)

```
Flow:
1. Shop connects WhatsApp number during onboarding/settings
2. When sending invoice:
   a. PDF generated client-side
   b. PDF uploaded to Supabase Storage (public URL)
   c. API call to BSP: send template message with PDF link to customer's WhatsApp
3. BSP returns message ID
4. Webhook receives delivery status updates (sent → delivered → read)
5. Status shown on invoice detail page

Template message example:
"Namaste {customer_name}! 🙏
Aapka bill #{invoice_number} ready hai.
Total: ₹{amount}
📄 Bill dekhne ke liye yahan tap karo: {pdf_link}
— {shop_name}"
```

### BSP comparison

| Feature | Gupshup | AiSensy |
|---|---|---|
| Pricing | ~₹0.30/msg conversation | ~₹0.40/msg conversation |
| Free tier | 1000 conversations/month (trial) | 1000 conversations/month (trial) |
| API quality | Good, REST + webhooks | Good, REST + webhooks |
| Template approval | 24-48 hours | 24-48 hours |
| Indian support | Yes (Mumbai) | Yes (Delhi) |
| Media messages | Yes (PDF, images) | Yes (PDF, images) |

### Phase 2: Meta Cloud API (direct, when volume justifies)

- Lower per-message cost at scale
- More control over message formatting
- Requires Meta Business verification
- Recommended at 5000+ messages/month

---

## 13. Invoice Templates

### Template 1: Classic

```
Style: Clean, formal, white background, green header bar with logo
Best for: Wholesale, medical stores
Features:
  - Full-width green header with shop logo + name
  - Formal table layout for line items
  - GST breakdown in separate box
  - UPI QR on bottom-right
  - Terms & conditions section
```

### Template 2: Modern

```
Style: Dark header section, rounded corners, bold typography
Best for: Salons, repair shops
Features:
  - Dark (#1E1C1A) header with white text
  - Card-style item list (not table)
  - Accent color highlights for totals
  - QR code centered at bottom
  - Clean sans-serif font (DM Sans)
```

### Template 3: Minimal

```
Style: Ultra-clean, lots of whitespace, thin borders only
Best for: Kirana, general stores
Features:
  - No background colors
  - Simple 1px border table
  - Small, compact layout (fits more items)
  - Logo top-left, small
  - Fastest to render/download
```

### Template 4: Branded

```
Style: Full color, shop logo prominent, custom accent color
Best for: Dhabas, restaurants
Features:
  - Large logo centered at top
  - Shop's brand color as accent (configurable)
  - Decorative border pattern
  - "Thank you for visiting!" message area
  - QR code with custom frame
```

### Template selection UI

```
Settings → Templates page:
  - 4 visual preview cards (mini invoice mockups)
  - Click to preview full-size
  - Click "Use this" to select
  - Current template has green checkmark
  - Can change anytime (applies to future invoices only)
```

---

## 14. Multi-Language (i18n)

### Supported languages

| Code | Name | Usage |
|---|---|---|
| `en` | English | Dashboard + invoices in English |
| `hi` | Hindi | Dashboard in Hindi, invoices in Hindi |
| `kn` | Kannada | Dashboard in Kannada, invoices in Kannada |
| `hinglish` | Hinglish | Dashboard in Hinglish (default), invoices in English |

### Implementation

```
Library: next-intl
Translation files: /public/locales/{lang}/
File structure per language:
  - common.json (nav, buttons, general)
  - dashboard.json (stat cards, activity feed)
  - invoice.json (builder, preview, PDF)
  - onboarding.json (setup wizard)
  - settings.json
  - errors.json (validation messages)
```

### Example Hinglish translations

```json
{
  "dashboard": {
    "greeting": "Namaskar, {name} bhai 👋",
    "today_revenue": "Aaj ki Kamai 💰",
    "pending_payments": "Pending Payments ⏳",
    "bills_sent": "Bills Bheje Aaj 📨",
    "new_customers": "Naye Customers 🤝",
    "recent_bills": "Recent Bills 🧾",
    "activity": "Live Activity ⚡",
    "view_all": "Sab dekho →"
  },
  "invoice": {
    "new": "Naya Invoice Banao 🧾",
    "customer_name": "Customer ka Naam",
    "whatsapp_number": "WhatsApp Number",
    "add_item": "Aur item jodo",
    "send_whatsapp": "WhatsApp pe Bhejo 🚀",
    "sending": "Bhej rahe hain...",
    "sent_success": "{name} ko WhatsApp pe invoice deliver ho gaya"
  }
}
```

### Language switching

- Set during onboarding (Step 6)
- Changeable anytime in Settings → Language
- Applies to dashboard UI and invoice PDF text
- Stored in `shops.language` column
- `next-intl` middleware detects and applies per user session

---

## 15. Theme System (Dark/Light)

### Implementation

```
Library: next-themes
Storage: localStorage + shops.theme (synced to DB)
CSS approach: Tailwind CSS dark: variant + CSS custom properties
```

### Color tokens

```css
/* Light mode */
:root {
  --bg: #FAF8F4;         /* paper */
  --bg2: #F2EFE9;        /* surface */
  --bg3: #E8E4DC;        /* surface-alt */
  --border: #D4D0C8;
  --text: #0F0E0C;       /* ink */
  --text2: #6B6860;      /* ink-muted */
  --text3: #9A9690;
  --green: #1B7A4A;      /* brand-green */
  --accent: #E84B2A;     /* brand-accent */
}

/* Dark mode */
.dark {
  --bg: #0F0E0C;
  --bg2: #161513;
  --bg3: #1E1C1A;
  --border: #2E2C28;
  --text: #F0EDE6;
  --text2: #9A9690;
  --text3: #5C5A56;
  --green: #2BB673;
  --accent: #E8622A;
}
```

### Toggle

- Icon button in topbar (sun/moon)
- Also in Settings → Appearance
- Respects system preference on first visit
- No flash on page load (next-themes handles this)

---

## 16. Mobile-First Design

### Layout rules

| Breakpoint | Layout |
|---|---|
| < 768px (mobile) | Bottom navigation, single column, sheets for forms |
| 768-1024px (tablet) | Sidebar collapsed by default, 2-column where needed |
| > 1024px (desktop) | Sidebar expanded, 2-column invoice builder |

### Mobile-specific patterns

- **Bottom navigation** (5 items): Dashboard, New Bill, Invoices, Customers, More
- **"Naya Bill" button** is center + elevated (biggest, green, always visible)
- **Large tap targets:** All buttons minimum 44px height
- **Swipe gestures:** Swipe invoice row for quick actions (Send/Mark Paid)
- **Pull-to-refresh:** On all list pages
- **Bottom sheets:** Invoice preview, customer picker, product search
- **Skeleton loading:** Feels faster than spinners
- **Sticky headers:** Stat cards scroll away, filters stay pinned

### Sidebar toggle (desktop)

- Expand/collapse button at bottom of sidebar
- Collapsed: icon-only (60px wide)
- Expanded: icons + labels (220px wide)
- State persisted in localStorage
- On mobile: sidebar replaced by bottom nav (no toggle needed)

---

## 17. Analytics Dashboard

### Stat cards (top row)

| Card | Metric | Color | Sub-text |
|---|---|---|---|
| Revenue | Today's total sales | Green | "Kal se +X% zyada" |
| Pending | Unpaid invoice amount | Gold | "X invoices awaiting" |
| Bills sent | Today's WhatsApp deliveries | Blue | "WhatsApp delivery X%" |
| New customers | This week's new customers | Accent | "Is hafte total X" |

### Charts

1. **Weekly revenue bar chart** — Mon to Sun, current day highlighted
2. **Monthly revenue trend** — 30-day daily bars, hover for details
3. **Payment method breakdown** — Progress bars (UPI %, Cash %, Bank %)
4. **Top selling items** — Progress bars (top 5 items by revenue)

### Tables

1. **Top customers this month** — Rank, name, bill count, total spent, last purchase
2. **GST summary** — Taxable amount, CGST, SGST, Total GST (monthly)
3. **Overdue invoices** — Customer, amount, days overdue, action buttons

### Filters

- Date range: Today, This Week, This Month, Custom range
- Comparison: vs previous period (e.g., "This month vs last month")

---

## 18. CSV Import

### Contacts CSV import

```
Location: Customers → Import button
Flow:
  1. Upload CSV file (max 5MB)
  2. Preview first 5 rows
  3. Column mapping UI (drag & match):
     - Map "Name" column → customer.name
     - Map "Phone" / "Mobile" → customer.phone
     - Map "Address" → customer.address
     - Ignore unmapped columns
  4. Validation:
     - Phone number format check
     - Duplicate detection (by phone within shop)
     - Show errors inline (red rows)
  5. Confirm import
  6. Success: "247 customers imported! 3 duplicates skipped."

Supported formats: .csv, .tsv
Encoding: UTF-8 (handle BOM)
```

### Products CSV import (similar flow)

```
Column mapping:
  - Product Name → products.name
  - Price → products.price
  - Unit → products.unit
  - Category → products.category
  - HSN Code → products.hsn_code
  - Stock → products.stock_qty
```

### Customer name editing

```
During invoice creation:
  - Customer picker shows saved name
  - Pencil icon next to name → inline edit
  - Changes saved to customer record
  - "Name change karna hai?" confirmation
```

---

## 19. Staff & Roles

### Role permissions matrix

| Permission | Admin | Billing | Viewer |
|---|---|---|---|
| View dashboard | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ✅ |
| Create invoice | ✅ | ✅ | ❌ |
| Send WhatsApp | ✅ | ✅ | ❌ |
| Mark as paid | ✅ | ✅ | ❌ |
| Add customers | ✅ | ✅ | ❌ |
| Add products | ✅ | ✅ | ❌ |
| Create quotation | ✅ | ✅ | ❌ |
| View invoices | ✅ | ✅ | ✅ |
| Edit shop settings | ✅ | ❌ | ❌ |
| Manage staff | ✅ | ❌ | ❌ |
| Change template | ✅ | ❌ | ❌ |
| Export data | ✅ | ❌ | ❌ |
| Delete data | ✅ | ❌ | ❌ |
| Manage subscription | ✅ | ❌ | ❌ |

### Staff invite flow

```
1. Admin goes to Settings → Staff
2. Clicks "Add Staff"
3. Enters: Name, Phone, Role
4. System sends WhatsApp invite (or SMS) with setup link
5. Staff clicks link → creates their PIN → can access dashboard
6. Activity log shows: "Raju added as billing staff by Admin"
```

---

## 20. Phased Build Plan

### Phase 1 — Foundation (Week 1-2)

**Goal: User can sign up, onboard, create an invoice, generate PDF**

| Day | Task | Details |
|---|---|---|
| 1 | Project setup | Next.js 14 + Tailwind + shadcn/ui + TypeScript |
| 1 | Supabase setup | Create project, run all migration SQL files |
| 2 | Auth: Phone OTP | Login + signup + forgot password pages |
| 3-4 | Onboarding wizard | 8 steps, all form fields, shop creation |
| 5 | Dashboard layout | Sidebar, topbar, theme toggle, language switcher, responsive |
| 6 | Product catalog | CRUD operations, default catalogs per shop type |
| 7 | Customer CRUD | Add/edit/delete + CSV import |
| 8-9 | Invoice builder | Full form + live preview panel |
| 10 | PDF generation | 4 invoice templates, client-side rendering |
| 11 | Payment mode | Cash/UPI/pending selector + UPI QR generation |
| 12 | Mobile responsive | All pages + bottom nav + sheets |
| 12 | Dark/light theme | Full theme system with CSS variables |
| 13-14 | Test + deploy | Vercel deployment, end-to-end testing |

**Phase 1 deliverable:** Working app — sign up → set up shop → add products → create invoice → download PDF → mark as paid. No WhatsApp yet.

### Phase 2 — WhatsApp & Quotations (Week 3-4)

**Goal: Send invoices via WhatsApp, quotation workflow**

| Day | Task | Details |
|---|---|---|
| 15-17 | WhatsApp BSP integration | Connect Gupshup/AiSensy, get templates approved |
| 18 | Send invoice PDF via WhatsApp | Upload PDF + send template message |
| 19 | Delivery status tracking | Webhook → update invoice wa_status |
| 20-21 | Quotation builder | Reuse invoice builder with modifications |
| 22 | Quotation → Invoice conversion | One-click convert with edit capability |
| 23 | Quotation PDF | Different template, no QR, "QUOTATION" header |
| 24 | Send quotation via WhatsApp | Same flow as invoice |
| 25 | Invoice list page | Filters, search, sort, bulk actions |
| 26 | Quotation list page | Status filters, convert buttons |
| 27 | Activity feed | Real-time dashboard activity log |
| 28 | Testing + bug fixes | Full flow testing |

**Phase 2 deliverable:** Full invoice + quotation workflow with WhatsApp delivery.

### Phase 3 — Analytics & Polish (Week 5-6)

**Goal: Business insights, staff access, production-ready**

| Day | Task | Details |
|---|---|---|
| 29-31 | Analytics dashboard | Revenue charts, top items, customer insights |
| 32 | Charts | Daily/weekly/monthly revenue, payment methods |
| 33 | GST summary report | CGST/SGST/IGST breakdown, monthly summary |
| 34-35 | Staff management | Invite, roles, permissions enforcement |
| 36-38 | Multi-language | Translate ALL strings (en, hi, kn, hinglish) |
| 39 | Payment reminders | Manual "WhatsApp nudge" for pending invoices |
| 40 | Low stock alerts | Dashboard notification + settings threshold |
| 41 | PWA setup | Installable, offline invoice creation, service worker |
| 42 | Performance + Lighthouse | Bundle optimization, lazy loading, Core Web Vitals |

**Phase 3 deliverable:** Production-ready app with analytics, staff roles, 4 languages, PWA.

### Phase 4 — Scale & AI (Month 3+)

- Voice-to-invoice (Hinglish speech → structured invoice)
- Smart payment reminders (auto-schedule based on customer behavior)
- WhatsApp chatbot for customers ("Mera bill bhejo")
- Bulk invoice sending
- Expense tracking
- Razorpay subscription billing (Standard/Pro tiers)
- Thermal printer support (Bluetooth ESC/POS)
- Barcode scanning for products
- Multi-shop (branch management)

---

## 21. API Routes (tRPC)

### Router structure

```typescript
// server/routers/_app.ts
export const appRouter = router({
  auth: authRouter,
  shop: shopRouter,
  invoices: invoicesRouter,
  quotations: quotationsRouter,
  customers: customersRouter,
  products: productsRouter,
  analytics: analyticsRouter,
  whatsapp: whatsappRouter,
  payments: paymentsRouter,
  staff: staffRouter,
});
```

### Key endpoints per router

**auth:**
- `auth.sendOTP` — send OTP to phone
- `auth.verifyOTP` — verify and create session
- `auth.verifyPIN` — quick PIN login
- `auth.resetPIN` — reset via OTP

**shop:**
- `shop.create` — create shop during onboarding
- `shop.get` — get current shop details
- `shop.update` — update settings
- `shop.completeOnboarding` — mark onboarding done

**invoices:**
- `invoices.list` — paginated, filterable, searchable
- `invoices.get` — single invoice with items
- `invoices.create` — create invoice + items (transaction)
- `invoices.update` — edit draft invoice
- `invoices.delete` — soft delete
- `invoices.markPaid` — record payment
- `invoices.sendWhatsApp` — trigger WhatsApp delivery
- `invoices.generatePDF` — return PDF URL
- `invoices.getNextNumber` — atomic counter increment

**quotations:**
- `quotations.list`
- `quotations.create`
- `quotations.update`
- `quotations.convertToInvoice` — copy items + create invoice
- `quotations.sendWhatsApp`

**customers:**
- `customers.list` — searchable
- `customers.get` — with billing history
- `customers.create`
- `customers.update`
- `customers.delete`
- `customers.importCSV` — parse + validate + bulk insert
- `customers.search` — fuzzy search by name/phone

**products:**
- `products.list` — filterable by category, active status
- `products.create`
- `products.update`
- `products.delete`
- `products.updateStock` — manual stock adjustment
- `products.getLowStock` — items below alert threshold
- `products.importCSV`

**analytics:**
- `analytics.revenue` — daily/weekly/monthly revenue
- `analytics.topProducts` — top N products by revenue
- `analytics.topCustomers` — top N customers by spend
- `analytics.paymentMethods` — breakdown by mode
- `analytics.gstSummary` — monthly GST calculation
- `analytics.overview` — dashboard stat cards data

**whatsapp:**
- `whatsapp.sendInvoice` — send PDF via BSP
- `whatsapp.sendQuotation` — send quotation PDF
- `whatsapp.sendReminder` — payment reminder message
- `whatsapp.getStatus` — check delivery status

**payments:**
- `payments.record` — record a payment against invoice
- `payments.list` — payment history for invoice/shop

**staff:**
- `staff.list` — all staff for shop
- `staff.invite` — send invite
- `staff.updateRole` — change permissions
- `staff.deactivate` — revoke access

---

## 22. Third-Party Accounts Needed

Create these BEFORE starting development:

| Service | URL | What you need | Cost |
|---|---|---|---|
| **Supabase** | supabase.com | Project URL + anon key + service role key | Free (500MB DB) |
| **Vercel** | vercel.com | Already set up (billdost project) | Free (Hobby) |
| **Gupshup** | gupshup.io | API key + WhatsApp phone number | Free trial, then per-msg |
| **Razorpay** | razorpay.com | Key ID + Key Secret (test mode first) | 2% per transaction |
| **GitHub** | github.com | Already set up (chethxnnn/billdost) | Free |

### Optional (Phase 2+)

| Service | Purpose |
|---|---|
| **Resend** or **Postmark** | Transactional emails (receipts, password reset) |
| **Sentry** | Error monitoring in production |
| **PostHog** or **Mixpanel** | Product analytics (feature usage) |
| **Upstash Redis** | Rate limiting, caching (if needed at scale) |

---

## 23. Environment Variables

Create `.env.local` file (NEVER commit to git):

```env
# ========== SUPABASE ==========
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

# ========== AUTH ==========
NEXTAUTH_SECRET=generate-a-random-string-here
NEXTAUTH_URL=http://localhost:3000

# ========== WHATSAPP BSP ==========
GUPSHUP_API_KEY=your-gupshup-api-key
GUPSHUP_APP_NAME=BillDost
GUPSHUP_SOURCE_PHONE=919876543210

# ========== RAZORPAY ==========
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# ========== APP ==========
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LANDING_URL=https://billdost.in
```

Create `.env.example` with same keys but empty values (commit this).

---

## 24. Deployment Checklist

### Before first deploy

- [ ] All env vars set in Vercel dashboard (Settings → Environment Variables)
- [ ] Supabase project created + migrations run
- [ ] RLS policies enabled on all tables
- [ ] WhatsApp template messages submitted for approval
- [ ] Razorpay test mode working
- [ ] `vercel.json` has SPA rewrites

### Before each release

- [ ] `npm run build` passes locally
- [ ] All TypeScript errors resolved
- [ ] Zod schemas validate all user inputs
- [ ] Mobile responsive checked (Chrome DevTools: iPhone SE, Pixel 5, iPad)
- [ ] Dark + light theme tested
- [ ] All 4 languages spot-checked
- [ ] Invoice PDF renders correctly in all 4 templates
- [ ] WhatsApp delivery tested in Gupshup sandbox

### Production launch

- [ ] Switch Razorpay to live mode
- [ ] Switch Gupshup to live mode
- [ ] Enable Vercel Analytics
- [ ] Set up Supabase database backups (auto, daily)
- [ ] Add custom domain `app.billdost.in` on Vercel
- [ ] SSL verified on all domains
- [ ] Error monitoring set up (Sentry)
- [ ] Legal pages link to live URLs
- [ ] Test with 3-5 real shopkeepers before public launch

---

## 25. Future Roadmap (Post-MVP)

### Tier 1 (Month 3-4)

- Voice-to-invoice (Hinglish speech-to-text → structured data)
- WhatsApp chatbot for customers
- Smart auto-reminders (scheduled based on due dates)
- Photo-to-invoice (OCR on handwritten bills)
- Thermal printer support

### Tier 2 (Month 5-6)

- Demand forecasting (predict reorder quantities)
- WhatsApp business assistant (shop owner can query via WhatsApp: "Aaj kitni kamai hui?")
- Auto-catalog builder (suggest products based on shop type + region)
- Credit scoring for customers

### Tier 3 (Month 7-9)

- GST auto-filing integration
- Anomaly detection (unusual billing patterns)
- AI marketing campaigns via WhatsApp
- Multi-language PDF (generate invoice in customer's preferred language)

### Tier 4 (Month 10-12)

- Voice call bot for payment collection
- Expense tracking + profit/loss
- WhatsApp loyalty program (stamps, rewards)
- Multi-branch management
- B2B marketplace (supplier connections)

---

## 26. Key Decisions Pending

These need your input before starting development:

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Dashboard URL | `app.billdost.in` (subdomain) vs `billdost.in/dashboard` | Subdomain — cleaner, separate deployment |
| 2 | WhatsApp BSP | Gupshup vs AiSensy | Gupshup — cheaper, better API |
| 3 | Skip WhatsApp in Phase 1? | Build PDF-only first, add WhatsApp in Phase 2 | Yes — PDF first, WhatsApp Phase 2 |
| 4 | Design style | Match landing page (light, paper bg) vs dark mode default | Dark default + light toggle |
| 5 | Default language | English vs Hinglish | Hinglish — matches target user |
| 6 | Pricing enforcement | Free tier: 30 invoices/month hard limit? | Soft limit (warning at 25, block at 35) |
| 7 | Repo structure | Same repo as landing vs new repo | Same repo (monorepo) — easier |
| 8 | TypeScript strictness | Strict mode? | Yes — catches bugs early |

---

## 27. Contact & Resources

### Owner

- **Name:** Chethan (chethxnnn)
- **WhatsApp:** +91 87225 73214 / +91 96115 38171
- **Email:** hi@billdost.in
- **GitHub:** github.com/chethxnnn/billdost
- **Domain:** billdost.in (GoDaddy → Vercel)

### Live URLs

- **Landing:** https://billdost.in (or https://www.billdost.in)
- **Vercel fallback:** https://billdost.vercel.app
- **Dashboard (future):** https://app.billdost.in

### Key links

- Supabase docs: https://supabase.com/docs
- Next.js App Router: https://nextjs.org/docs/app
- tRPC: https://trpc.io/docs
- shadcn/ui: https://ui.shadcn.com
- Gupshup WhatsApp API: https://docs.gupshup.io/docs/whatsapp-overview
- Razorpay Subscriptions: https://razorpay.com/docs/payments/subscriptions
- next-intl: https://next-intl-docs.vercel.app
- next-themes: https://github.com/pacocoursey/next-themes

---

## Quick Start Commands (When Ready)

```bash
# 1. Create new Next.js project
npx create-next-app@latest billdost --typescript --tailwind --eslint --app --src-dir

# 2. Install core dependencies
cd billdost
npm install @supabase/supabase-js @supabase/ssr @trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query zod react-hook-form @hookform/resolvers framer-motion next-themes next-intl jspdf html2canvas qrcode.react lucide-react

# 3. Install shadcn/ui
npx shadcn-ui@latest init

# 4. Install dev dependencies
npm install -D supabase

# 5. Link Supabase
npx supabase init
npx supabase link --project-ref your-project-ref

# 6. Run migrations
npx supabase db push

# 7. Generate types
npx supabase gen types typescript --linked > src/types/database.ts

# 8. Start dev server
npm run dev
```

---

> **This document is the single source of truth for the BillDost product build.** Every decision, every schema, every flow is documented here. When in doubt, refer back. When something changes, update this doc first, then code.
>
> **Build order: Phase 1 → test → Phase 2 → test → Phase 3 → launch.**
>
> **Don't build what you don't need yet. Ship fast, learn from real users, iterate.**

---

*Last updated: 18 May 2026*
*Next milestone: Phase 1 kickoff*
