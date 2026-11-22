# BillDost POS System - Project Status & Documentation

**Last Updated:** June 15, 2026
**Product Overview:** BillDost is a modern, responsive Point-of-Sale (POS) and inventory management system designed for shop owners. It features lightning-fast invoice generation, AI-powered insights, quotation management, and real-time inventory tracking.

---

## 🛠 Tech Stack
- **Framework:** Next.js 15+ (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Framer Motion (for animations)
- **Backend/API:** tRPC (Type-safe APIs)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email, Google, Phone via Twilio)
- **AI Integration:** Vercel AI SDK (`@ai-sdk/google`) using `gemini-2.0-flash`
- **State Management:** React Query (via tRPC) + Zustand
- **UI Components:** Lucide React (Icons), Sonner (Toasts)

---

## 🚀 Features Implemented (Till Date)

### 1. Authentication & Onboarding
- **Login/Signup:** Email & Password, Google OAuth.
- **Onboarding Flow:** Multi-step wizard capturing Shop details, Owner details, GST Information, and UPI integration.
- **Role-based Access:** Differentiates between Shop Owners and Staff (Cashiers, Managers).

### 2. Dashboard & Analytics
- **Overview:** Real-time metrics for Total Revenue, Total Invoices, New Customers.
- **Recent Activity:** Quick view of the latest invoices generated.
- **Theme Support:** Fully functional Light/Dark mode toggle with an Apple-esque glassmorphism aesthetic.

### 3. POS & Billing (Invoices)
- **Sequential Billing:** Bulletproof invoice numbering system that safely queries the database for the maximum sequence to prevent sync loops.
- **Quick Add Grid (Tabbed):** A split-screen POS interface for rapid billing. Allows clicking catalog items to add them instantly to the cart.
- **Drafts:** LocalStorage persistence so bills aren't lost if the page is accidentally reloaded.
- **Tax/Discount Logic:** Full support for GST calculation, flat discounts, and percentage discounts.
- **Invoice PDF & Print:** Professional receipt formatting.

### 4. Quotations
- **Quotation Generation:** Dedicated workflow for estimates/quotes.
- **Quotation to Invoice Conversion:** Seamlessly fetch existing quotation items (e.g., `QT-101`) to generate a new invoice. Converted quotations can also be reused as templates.
- **Sequential Numbering:** Bulletproof quotation numbering logic.

### 5. Catalog Management
- **Product Listing:** View all products with categories, HSN codes, and pricing.
- **CRUD Operations:** Create, Read, Update, Delete products.

### 6. Professional Stock Management (Inventory)
- **Dedicated Hub:** A standalone `/inventory` tab strictly for stock tracking.
- **Analytics Dashboard:** Tracks Total Items in Stock, Total Stock Value (₹), and Low Stock Alerts.
- **Rapid Stock Adjustment:** Quick inline modal to handle "Stock In (+)", "Stock Out (-)", or "Exact Audit (=)".
- **Real-time Updates:** Stock adjustments apply instantly to the database without reloading.

### 7. AI Features
- **Magic Extract:** Upload an image of a physical bill/invoice, and the AI (`gemini-2.0-flash`) will instantly OCR and extract all product details, prices, and quantities directly into the cart.
- **Smart Assistant:** An in-app assistant panel (right side on desktop, full sheet on mobile) with secure, direct access to the shop's database.
  - **Deterministic first (Nov 22, 2026):** the known daily questions (sales today/yesterday/week/month, top items, low stock, udhaar and top debtors, a named customer's history, payments today, GST this month, bill counts, navigation) are answered by a fixed intent engine (`src/lib/assistant/` + `src/server/assistant/engine.ts`) from fixed queries, composed from templates with exact figures. No model is involved, so these numbers cannot be invented.
  - **Fallback:** anything the engine does not match falls through to the Gemini tool-calling flow (`gemini-2.0-flash`), unchanged, with tools `getShopStats`, `getInvoices`, `getCustomers`, `getProducts`, `navigateApp`, hardcoded to only answer questions regarding the user's shop, inventory, sales, or app navigation.

### 8. UI / UX Design
- **Aesthetic:** "Premium Apple-like" design language. No generic colors. Uses curated HSL tokens, glassmorphism (`backdrop-blur`), subtle micro-animations, and clean dark modes.
- **Alerts:** Removed all browser-native `window.confirm` or `alert` dialogues in favor of smooth, non-blocking UI toasts (`sonner`).

---

## 🗄️ Database Architecture (Supabase)
Key tables currently active:
- `shops`: Stores core business info, GST, and branding.
- `users`: Links auth to application roles.
- `products`: Holds catalog data, price, `stock_qty`, and `low_stock_alert`.
- `customers`: Customer directory (Name, Phone, Email, GST).
- `invoices`: Master record of finalized bills.
- `invoice_items`: Line items mapping back to `invoices` and `products`.
- `quotations`: Master record of estimates.
- `quotation_items`: Line items mapping back to `quotations`.

---

## 🚧 Known Issues & Pending Features

1. **WhatsApp Integration (Baileys-based):**
   - *Status:* NOT STARTED.
   - *Goal:* Implement a persistent WhatsApp connection to send digital invoices and quotations directly to customers' numbers.
2. **Custom Loading Screens:**
   - *Status:* NOT STARTED.
   - *Goal:* Create a unique "BillDost" branded loading animation for route transitions and data fetching.
3. **Multi-User/Staff Access Restrictions:**
   - *Status:* PARTIAL.
   - *Goal:* Ensure cashiers only see the POS screen, while owners see analytics and stock. The DB RLS policies exist, but the frontend UI locking can be expanded.

---

## 💡 How to use this document
Whenever you start a new session with an AI Agent, simply tell them:
> *"Read `PROJECT_STATUS.md` in the root folder to understand what we've built, the tech stack we are using, and where we currently stand."*
