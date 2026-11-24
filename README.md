# CHAPTER ONE CAFE — SMART QR ORDERING SYSTEM

A complete, production-ready, secure, standalone QR-based ordering application built specifically for **Chapter One Cafe**.

This system is completely standalone, self-contained, and isolated inside this project directory. It does not integrate with or depend upon any existing POS software, external database, or third-party accounts.

---

## 🌟 Key Highlights & Capabilities

1. **Mobile-First Customer QR Experience (PWA):**
   - Instant menu loading with categories (Burgers, Pizza, Sandwiches, Pasta, Snacks, Beverages, Desserts, Combos, Special Offers).
   - Veg / Non-Veg indicators, high-resolution imagery, customizable options (add-ons, spice levels, milk choices), special instructions.
   - Persistent Cart with instant live calculations.
   - Real-time Order Tracking: `Order Received` → `Accepted` → `Preparing` → `Ready` → `Served`.

2. **Strict Cryptographic Table Identification & Zero-Trust Security:**
   - No predictable URLs (`/table/1` or `?table=04` are blocked).
   - Cryptographically random 32-character tokens generated for every table.
   - Server-authoritative table validation. Table tokens map strictly through the database.
   - Instant token revocation & one-click QR regeneration by the cafe admin.
   - Server-side price calculation: client cannot manipulate item prices or order sold-out items.
   - Idempotency key protection: prevents accidental double-orders from double-clicking or network retries.

3. **Persistent Customer Recognition (Privacy-Respecting):**
   - First-time guests enter name & mobile number with optional consent.
   - Generates persistent device tokens without invasive hardware fingerprinting.
   - Returning visits recognize customer name, loyalty points, and visit counts automatically.
   - One-click "Forget this device" / profile removal for complete privacy compliance.

4. **Official WhatsApp Click-to-Chat Prefilled Message:**
   - After order placement, generates a prefilled message formatted according to Chapter One Cafe specification:
     ```
     CHAPTER ONE CAFE
     NEW ORDER

     Order No: #1045
     Table: Table 04

     Customer: Rahul
     Phone: 98XXXXXXXX

     ORDER:

     1. Special Burger × 2 — ₹298
     2. Cold Coffee × 1 — ₹120
     3. French Fries × 1 — ₹99

     Special Instructions:
     No onions

     TOTAL: ₹517

     Order Time: 10:42 AM
     ```
   - Includes **[ SEND ORDER ON WHATSAPP ]** and **[ Copy Message Fallback ]**.
   - The order is securely saved in the database before the WhatsApp button is displayed.

5. **Dedicated Cafe PC Order-Receiver Dashboard (`/kitchen` or `/pc`):**
   - High-contrast fullscreen order receiver for the cafe counter / kitchen PC.
   - Real-time WebSocket connection with visual heartbeat status (`ONLINE`, `RECONNECTING`, `OFFLINE`).
   - Loud repeating multi-tone bell alarm synthesized directly via the Web Audio API (works without external mp3 downloads).
   - Fullscreen incoming-order alert modal with large table number, customer details, items, customizations, special instructions, and total.
   - Order lifecycle progression: `[ ACCEPT ORDER ]` → `[ PREPARING ]` → `[ READY ]` → `[ SERVED ]` → `[ ARCHIVE ]` or `[ REJECT ]` with reason.
   - Automatic Missed Order Recovery: On PC reconnect or reload, queries all outstanding active orders so zero tickets are lost.

6. **Customer Assistance Call Buttons:**
   - `[ Call Staff ]`, `[ Water ]`, `[ Bill ]` buttons placed prominently on customer tables.
   - Enforces 45-second anti-spam cooldowns per table session.
   - Instant audio chime and visual banner on the PC kitchen display with `[ Acknowledge ]` action.

7. **Table Management & Multi-Order Active Sessions:**
   - Groups multiple customer orders during one sitting into an active table session (e.g. `SESS-1045`).
   - Displays running table totals and order history.
   - One-click session closure & table reset.
   - Printable QR standee cards with built-in QR image generator.

8. **Admin Console (`/admin`):**
   - Protected with security PIN (Default: `1234`).
   - Full Menu Editor: Add/edit dishes, update prices, toggle availability ("In Stock" / "Sold Out"), mark popular items, add categories.
   - Customer CRM & Loyalty: View visit history, total spent, order count, loyalty points, delete customer profiles (GDPR).
   - Real-time Analytics & Financial Reports: Today's revenue, order count, Average Order Value (AOV), best sellers, orders by table.
   - Cafe Settings: Configure cafe name, tagline, official WhatsApp number, currency symbol, admin PIN.

---

## 🚀 Quickstart Guide

### 1. Start the Application
Run the unified server (serves API, WebSockets, and static frontend):
```bash
npm start
```
Or for development with live reload:
```bash
# Terminal 1: Backend & WebSocket
npm run server

# Terminal 2: Vite React Frontend
npm run client
```

### 2. Access the Application
- **Customer Mobile QR Ordering:** [http://localhost:4000/](http://localhost:4000/)  
  *(Open on mobile or use the built-in "Select Table" scanner simulator to test any table QR code)*
- **Cafe PC Order Receiver:** [http://localhost:4000/kitchen](http://localhost:4000/kitchen)
- **Admin Console:** [http://localhost:4000/admin](http://localhost:4000/admin) *(Default PIN: `1234`)*
- **API Health:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🧪 Automated Testing
Run the automated test suite verifying all 22 security, ordering, validation, and session requirements:
```bash
npm test
```
See [TEST_REPORT.md](TEST_REPORT.md) for detailed test logs.

---

## 📂 Project Architecture

```
Scan app/
├── client/                     # Mobile-first React 18 + TypeScript + Tailwind CSS PWA
│   ├── src/
│   │   ├── components/         # Navbar, MenuCard, CartDrawer, AssistanceBar, TableDemoModal
│   │   ├── pages/              # CustomerOrdering, OrderConfirmation, OrderTracking, KitchenDashboard, AdminDashboard
│   │   ├── services/           # Typed API Client & WebSocket Manager
│   │   ├── utils/              # Web Audio API Sound Synthesizer & Local Storage
│   │   ├── types.ts            # Data Contracts & Interfaces
│   │   ├── App.tsx             # Main Application Routing
│   │   └── main.tsx
│   ├── dist/                   # Production build distribution
│   └── package.json
│
├── server/                     # Standalone Express + WebSockets + SQLite Backend
│   ├── db/
│   │   ├── database.js         # SQLite connection, schema migration, and initial seeding
│   │   └── schema.sql          # Relational SQL schema
│   ├── middleware/
│   │   └── security.js         # Admin auth, anti-spam rate limiter, input sanitizer
│   ├── routes/
│   │   ├── tables.js           # Cryptographic QR validation, regen, revoke, sessions
│   │   ├── menu.js             # Menu items, categories, sold-out toggling
│   │   ├── customers.js        # Device token customer recognition & GDPR forget
│   │   ├── orders.js           # Server price validation, idempotency, WhatsApp generator
│   │   ├── requests.js         # Waiter, Water, Bill calls with rate limits
│   │   ├── analytics.js        # Revenue, AOV, best-seller reports
│   │   └── settings.js         # Cafe settings & WhatsApp configuration
│   ├── services/
│   │   └── websocket.js        # Real-time WebSocket broadcasting & recovery
│   └── server.js               # Entry point
│
├── supabase/                   # Optional Supabase / PostgreSQL Deployment Migration
│   └── migrations/
│       └── 20261123_initial_schema.sql  # Complete PostgreSQL schema with RLS policies
│
├── tests/
│   └── verify_system.js        # Automated End-to-End Test Suite (22/22 Passing)
│
├── .env                        # Local environment configuration
├── .env.example                # Template configuration
├── SECURITY.md                 # Security architecture & zero-trust design
├── TEST_REPORT.md              # Test execution log
└── package.json                # Root scripts and dependencies
```

---

## ☁️ Deployment Configuration

### Option A: Node.js / Docker / VPS / Render
1. Set environment variables: `PORT=4000`, `ADMIN_PIN=1234`, `WHATSAPP_NUMBER=919876543210`.
2. Build frontend: `npm run build`
3. Run: `npm start`

### Option B: Cloud Supabase & Vercel
1. Run the database migration script in [supabase/migrations/20261123_initial_schema.sql](supabase/migrations/20261123_initial_schema.sql) in your Supabase SQL editor.
2. Deploy the `server/` as a serverless backend or Docker container on Render/Railway/Fly.io.
3. Deploy the `client/` Vite app on Vercel or Netlify.
