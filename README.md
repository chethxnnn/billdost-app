# 🧾 BillDost

**BillDost** is a powerful, production-ready, multi-tenant billing and invoice management platform designed specifically for local shops and small businesses (like Hardware, Provision Stores, Cloth, and Jewellery shops). It provides an ultra-fast, mobile-optimized experience to manage customers, inventory, quotations, and seamless WhatsApp invoicing.

---

## ✨ Key Features

- **Multi-Tenant Architecture:** Securely supports multiple shop owners in a single database using Supabase Row-Level Security (RLS).
- **Fast Invoicing & Quotations:** Beautiful, category-specific invoice PDFs (Hardware, Jewellery, Cloth, etc.) generated entirely on the client-side.
- **Background WhatsApp Integration:** Send PDF bills directly to customers' WhatsApp in one click, without redirecting away from the app. Powered by a self-hosted `whatsapp-web.js` microservice.
- **Inventory Management:** Track stock levels, low-stock alerts, and auto-deduct items upon invoice creation.
- **Customer Analytics:** Track customer history, lifetime value, and outstanding balances.
- **Staff Management:** Role-based access control (Owner vs. Cashier) to restrict sensitive pages like Analytics and Settings.
- **Fully Responsive:** Feels like a native app on mobile (bottom navigation) while utilizing a powerful sidebar dashboard on desktop.

---

## 🛠️ Tech Stack

### Frontend (Main Application)
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS & shadcn/ui components
- **State & Data Fetching:** tRPC & React Query
- **Forms:** React Hook Form & Zod Validation
- **PDF Generation:** html2canvas & jsPDF

### Backend & Database
- **Backend APIs:** Next.js Server Actions & tRPC API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email & OAuth)

### Microservice (WhatsApp)
- **Runtime:** Node.js & Express
- **WhatsApp API:** `whatsapp-web.js` (Puppeteer)

---

## 📂 Project Structure

This repository is structured as a monorepo containing two main parts:

```
billdost-app/
├── billdost/               # The main Next.js Application (Frontend & API)
│   ├── src/app/            # App Router pages (Dashboard, Auth, Onboarding)
│   ├── src/components/     # Reusable UI components & Layouts
│   ├── src/server/         # tRPC Routers and server utilities
│   └── ...
└── whatsapp-service/       # The standalone Node.js WhatsApp Microservice
    ├── Dockerfile          # Deployment configuration for Render/Railway
    ├── index.js            # Express server handling WA connections
    └── ...
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A free [Supabase](https://supabase.com/) account for Database and Auth.

### 2. Setup the Main App (`billdost`)

Navigate to the `billdost` directory and install dependencies:
```bash
cd billdost
npm install
```

Create a `.env.local` file in the `billdost` folder and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Run the development server:
```bash
npm run dev
```
The app will be available at [http://localhost:3000](http://localhost:3000).

### 3. Setup the WhatsApp Microservice (`whatsapp-service`)

Open a new terminal, navigate to the `whatsapp-service` directory, and install dependencies:
```bash
cd whatsapp-service
npm install
```

Run the microservice:
```bash
npm start
```
The microservice will run on [http://localhost:3001](http://localhost:3001). 

> **Note:** Go to **Settings > WhatsApp** in the BillDost dashboard to scan the QR code and link your device!

---

## ☁️ Deployment Guide

### Deploying the Main App (Vercel)
The main Next.js app is optimized for Vercel. 
1. Connect this GitHub repository to Vercel.
2. Set the **Root Directory** to `billdost`.
3. Add your Supabase environment variables.
4. Deploy!

### Deploying the WhatsApp Service (Railway / Render)
Because the WhatsApp service relies on a continuous background Chromium process, it cannot be hosted on serverless platforms like Vercel.
1. Connect this GitHub repository to [Railway.app](https://railway.app/).
2. Set the **Root Directory** to `whatsapp-service`.
3. Railway will automatically detect the provided `Dockerfile` and install all necessary Linux Chromium dependencies.
4. Once deployed, take the public URL provided by Railway and update the `WHATSAPP_SERVICE_URL` inside the Next.js app to point to your live microservice!

---

## 🔒 Security & Privacy
- **No Credentials in Repo:** Environment variables and secrets are strictly ignored via `.gitignore`.
- **Row-Level Security:** Supabase RLS policies ensure that Shop Owners can only ever query and view data belonging to their specific `shop_id`.
