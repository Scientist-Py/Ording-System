# CHAPTER ONE CAFE — SECURITY ARCHITECTURE & DESIGN

## 1. Overview
Chapter One Cafe QR ordering system is designed from the ground up as a **server-authoritative, standalone, zero-trust system**. Public clients (customer browsers) are never trusted for identity, table assignment, or pricing.

---

## 2. Core Security Controls

### 2.1 Server-Authoritative Table Identification & Cryptographic QR Tokens
- **No Sequential or Predictable Table URLs:** Table numbers are never exposed in public URLs (e.g. `/table/1`, `?table=04` are explicitly disallowed).
- **Cryptographic Random Tokens:** Each table is assigned a 32-character hexadecimal token generated via `crypto.randomBytes(16).toString('hex')`.
- **Database Mapping:** Public scans hit `/table/:token` which looks up the active table in the database where `is_revoked = 0`.
- **Server Verification on Every Order:** When placing an order, the client sends `qrToken`. The server queries the database, extracts the true table ID, and associates the order. A customer cannot modify or spoof the table identity.
- **Token Revocation & Regeneration:** The cafe administrator can instantly revoke or regenerate a table's QR token with a single click. The previous QR token is immediately invalidated.

### 2.2 Server-Side Price & Availability Calculation
- **Zero Client Price Trust:** The frontend never submits prices.
- **Strict Database Lookup:** For every item in an order, unit prices (`price` or `offer_price`) and customization extra costs are retrieved strictly from `menu_items`.
- **Sold-Out Item Protection:** Even if a client modifies local browser code to order a sold-out item, the server checks `is_available === 1` and rejects the order with HTTP 400.

### 2.3 Idempotency & Accidental Duplicate Order Defense
- **Unique Client-Side Idempotency Keys:** Every checkout attempt attaches a unique UUID idempotency key.
- **Safe Retries:** If a customer double-clicks, experiences flaky cellular connectivity, or refreshes the confirmation page, the server detects the existing `idempotency_key` and returns the already-created order without billing twice or creating duplicate kitchen tickets.

### 2.4 Privacy-Respecting Customer Recognition
- **No Invasive Hardware Fingerprinting:** Device identity uses standard cryptographically random UUID tokens generated upon customer consent.
- **No Cross-Customer Data Exposure:** A device token only recognizes the customer's own first name, mobile number, and loyalty points. It never grants access to other customers' order history or table sessions.
- **Forget Device (GDPR / Privacy Compliance):** Customers can click "Not you? Forget device" or "Remove saved profile" to instantly disassociate their device.

### 2.5 Request Rate Limiting & Cooldown Protection
- **Assistance Button Cooldowns:** Calls for Waiter, Water, or Bill enforce a 45-second cooldown per table session, preventing denial-of-service spam or accidental repeated taps.
- **Input Sanitization:** Customer names, special instructions, and rejection notes are stripped of angle brackets (`< >`) and length-capped to 500 characters to prevent Cross-Site Scripting (XSS).

### 2.6 Admin Authentication & RBAC
- **PIN-Protected Endpoints:** Administrative endpoints (`/api/tables`, `/api/menu/*`, `/api/customers`, `/api/analytics/*`, `/api/settings`) require the configured admin PIN passed via `x-admin-pin` or `Authorization: Bearer <pin>`.
- **Public API Isolation:** Public endpoints only expose sanitized menu data and table validity status.

### 2.7 Realtime Event Scoping
- **Scoped Broadcasts:** Customer tracking rooms only listen for events matching their specific `orderNumber`.
- **Persistent Missed Order Recovery:** Realtime WebSocket events are not the sole source of truth. The PC Receiver fetches `/api/orders/active` on boot and upon reconnection, guaranteeing no orders are missed even during network drops.

---

## 3. Known Limitations & Operational Recommendations
1. **Physical Standee Protection:** If a customer physically photographs a table QR code and takes it home, they could technically place orders while off-premises.
   - *Mitigation:* The cafe staff has one-click "Regenerate QR" in the admin dashboard to rotate table tokens at any time. Geofencing can be added as an optional future feature.
2. **HTTPS in Production:** In production deployment (e.g. Vercel, Render, VPS), ensure TLS/HTTPS is terminated at the edge so device tokens and admin credentials are encrypted in transit.
3. **Database Backups:** The SQLite database `chapter_one.db` uses Write-Ahead Logging (WAL) for high concurrency and can be backed up with standard SQLite file snapshots or migrated to Supabase/PostgreSQL using the included `supabase/migrations/` script.
