# ZERØ CLOTHING — Ecommerce Backend Architecture & Audit

> Senior full-stack architecture review and build plan to turn the current
> static site into a real ecommerce business (H&M / Zara / ASOS / ODEL class).
>
> **Status of the current site:** fully designed, fully static, **zero backend**.
> This document is the blueprint; the `/backend` folder in this repo is the
> runnable foundation that implements the first slice (auth + orders + schema).

---

## 0. The single most important fact

**GitHub Pages (where this site is published) can only serve static files.**
It cannot run a server, hold a database, process a card, or send an email.

So "the backend" is a **separate application** that the existing HTML/JS will
call over HTTPS. The frontend stays where it is (or moves to a CDN); the new
API + database + file storage + email run on a host that supports servers.

```
            Browser (existing ZERØ frontend, static)
                        │  HTTPS (fetch / JSON)
                        ▼
         ┌──────────────────────────────────────┐
         │   ZERØ API  (Node.js + Express)        │
         │   auth · orders · payments · admin     │
         └───────┬───────────┬───────────┬────────┘
                 │           │           │
         ┌───────▼──┐  ┌─────▼─────┐  ┌──▼────────────┐
         │ Postgres │  │ S3 bucket │  │ Email provider │
         │ (data)   │  │ (uploads) │  │ (Resend/SES)   │
         └──────────┘  └───────────┘  └────────────────┘
                 │
         ┌───────▼──────┐   ┌──────────────┐   ┌──────────────┐
         │ Redis        │   │ Payment GW    │   │ Courier API   │
         │ (sessions,   │   │ (PayHere/     │   │ (Domex/Koombiyo│
         │  cache, queue)│  │  Stripe)      │   │  /SL Post)    │
         └──────────────┘   └──────────────┘   └──────────────┘
```

---

## Table of contents

1. [Full audit report](#1-full-audit-report)
2. [Missing functionality list](#2-missing-functionality-list)
3. [Database schema](#3-database-schema)
4. [Backend architecture](#4-backend-architecture)
5. [API architecture](#5-api-architecture)
6. [Authentication system](#6-authentication-system)
7. [Email automation flows](#7-email-automation-flows)
8. [Payment integration architecture](#8-payment-integration-architecture)
9. [Admin dashboard architecture](#9-admin-dashboard-architecture)
10. [Customer account architecture](#10-customer-account-architecture)
11. [Shipping workflow](#11-shipping-workflow)
12. [Production workflow for custom clothing](#12-production-workflow-for-custom-clothing)
13. [Security checklist](#13-security-checklist)
14. [Step-by-step implementation plan](#14-step-by-step-implementation-plan)

---

## 1. Full audit report

### 1.1 What the site actually is today

The entire site is **HTML + CSS + vanilla JS** served as static files. The only
"persistence" is the browser's `localStorage`, wrapped in `window.ZERO.store`
(`assets/js/app.js`). A repo-wide search confirms **no `fetch`, `XMLHttpRequest`,
`axios`, or any network call exists** — nothing ever leaves the browser.

All catalog data lives in a static array in `assets/js/data.js` (`PRODUCTS`,
`REVIEWS`, `SHIPPING`, `SL_PROVINCES`, `SL_DISTRICTS`, `CUSTOM_TYPES`,
`PRINT_PRICES`, `FILTER_*`). It is a high-quality **visual prototype** of a store,
not a store.

### 1.2 Page-by-page technical audit

| Page | What works (UI) | What is fake / missing (backend) | Severity |
|------|-----------------|----------------------------------|----------|
| `index.html` (home) | Renders featured products, reviews, marketing | Featured list from static array; reviews hardcoded; newsletter input not wired | Low |
| `shop.html` | Filtering, sorting, price range, chips — all real client logic | Operates on static `PRODUCTS`; no pagination, no server, no real stock/availability truth | High |
| `product.html` | Gallery, variants, qty, accordions, related, sticky buy | Product from static array; **rating/reviews hardcoded**; size availability (`oos`) is static; "Add to Bag" only mutates localStorage | High |
| `customize.html` | Live design studio: upload, text, fonts, drag, price calc | **Uploaded artwork stored as base64 in localStorage and never uploaded**; no production file generated; "Save design" writes to localStorage only | Critical |
| `checkout.html` | Address fields, shipping options, payment selector, coupon, receipt upload UI | **No order is stored**, **no payment is processed**, card form is cosmetic, coupons hardcoded (`ZERO10`, `FREESHIP`), **no tax**, receipt "verification" is a `setTimeout`, order # is `Math.random()` | Critical |
| `tracking.html` | Timeline UI by order/phone/email | **Timeline is hardcoded to step 2**; does not look anything up; accepts any input | Critical |
| `account.html` | Dashboard, orders, wishlist, designs, addresses, payments, rewards, settings | **No login required** — shows hardcoded "Nimal Perera", fake orders `ZRO-9F2K1` etc., fake `2,450` points to *anyone*; "Save changes" is a toast | Critical |
| `contact.html` | Contact form + FAQ accordion | Form does `e.preventDefault(); reset(); toast()` — **message goes nowhere**, no ticket, no email | High |
| `acid-wash.html`, `couples.html` | Editorial collection pages | Static content; product strips from static array | Low |

### 1.3 Broken / non-functional forms (every form on the site)

1. **Checkout form** (`#checkoutForm`) → fabricates an order id, clears cart, redirects. No DB, no payment, no email.
2. **Card payment fields** → plain inputs, never tokenized, never sent to a gateway. **Must never collect raw PAN like this in production.**
3. **Bank transfer receipt upload** (`#receiptInput`) → file is read into the page label only; never uploaded; "verifying" is a timer.
4. **Coupon form** (`#applyCoupon`) → two hardcoded codes; no validation, no usage limits, no expiry.
5. **Contact form** (`#contactForm`) → resets and toasts; nothing sent.
6. **Newsletter input** (footer) → not wired to anything.
7. **Account profile form** → "Save Changes" toast only.
8. **Account "Add Address" / "Add Card"** → dead buttons.
9. **Tracking lookup** (`#trackBtn`) → renders a fixed timeline regardless of input.
10. **Customize "Save design" / "Add to bag"** → localStorage only; artwork not persisted server-side.

### 1.4 Missing backend connections (summary)

- **No API layer** (0 endpoints).
- **No database** (catalog, orders, users, inventory all absent or static).
- **No authentication** (no users, sessions, or access control of any kind).
- **No payment integration** (no gateway, no verification, no refunds).
- **No email/SMS triggers** (no transactional messaging).
- **No file storage** (uploads live as base64 in the visitor's browser).
- **No admin tooling** (no way to see or fulfill an order).
- **No analytics** (no events, funnels, or revenue tracking).

---

## 2. Missing functionality list

Grouped by domain, mapped to the build sections below.

**Authentication & identity**
- Sign up, login, logout, forgot/reset password, email verification, Google OAuth, sessions, "remember me", profile, account security (2FA optional), rate limiting on auth.

**Customer account**
- Real order history, live order tracking, saved addresses (CRUD), wishlist (server-synced), saved custom designs (server-stored artwork), payment methods (tokenized), settings, notifications, rewards/points, coupons/store credit.

**Catalog & inventory**
- Products/variants in DB, categories, real stock per variant, low-stock alerts, back-in-stock, price/sale management, product reviews (verified-buyer), search/pagination.

**Cart & checkout**
- Server cart + persistence across devices, server-side price/tax/shipping recompute, coupon engine (limits/expiry/eligibility), idempotent order creation, abandoned-cart capture.

**Payments**
- Gateway integration (cards via PayHere/Stripe), eZ Cash, bank transfer + receipt verification workflow, COD, refunds, chargebacks, webhook verification, duplicate-payment prevention.

**Orders & fulfillment**
- Persisted orders with full snapshot, unique order numbers, status state-machine, shipping label/tracking, production workflow for custom prints, returns/exchanges.

**Operations**
- Admin dashboard (orders, customers, products, inventory, coupons, payments, tickets, content), reports/exports, role-based access, audit logs.

**Comms**
- Transactional email (12+ triggers) + templates, SMS for shipping, support tickets, abandoned-cart reminders.

**Cross-cutting**
- Analytics/events, security hardening, observability/logging, backups, GDPR/PDPA data handling.

---

## 3. Database schema

PostgreSQL is the recommended store (relational integrity for orders/payments,
JSONB for flexible snapshots, strong ecosystem). The **authoritative, runnable
schema** is in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Below is the conceptual model.

### 3.1 Entity overview

```
users ─┬─< addresses
       ├─< orders ─┬─< order_items ─── (product_variant snapshot)
       │           ├─1 payment ──< payment_events
       │           ├─1 shipment ──< shipment_events
       │           └─< order_status_history
       ├─< cart (1) ─< cart_items
       ├─< wishlist_items >─ products
       ├─< custom_designs ──< design_assets   (S3 keys)
       ├─< reviews >─ products
       ├─< notifications
       ├─< sessions / refresh_tokens
       ├─1 loyalty_account ─< loyalty_transactions
       ├─< coupon_redemptions >─ coupons
       └─< support_tickets ─< ticket_messages

categories ─< products ─< product_variants ─1 inventory
coupons (rules)            email_queue (outbox)
admin_users ─< audit_logs  analytics_events
```

### 3.2 Core tables (fields summarized — full types in Prisma file)

**users** — id, email (unique), email_verified_at, password_hash (nullable for OAuth-only), first_name, last_name, phone, google_id, role(`customer`), status, marketing_opt_in, created_at, last_login_at.

**sessions / refresh_tokens** — id, user_id, token_hash, user_agent, ip, expires_at, revoked_at. (Access = short-lived JWT; refresh = rotating, stored hashed.)

**email_verifications / password_resets** — id, user_id, token_hash, expires_at, used_at.

**addresses** — id, user_id, label, recipient_name, phone, line1, line2, city, district, province, postal_code, country(`LK`), is_default_shipping, is_default_billing.

**categories** — id, slug, name, parent_id, position.

**products** — id, slug, name, description, category_id, base_price_cents, compare_at_cents, currency(`LKR`), status(`active|draft|archived`), badge, tags[], rating_avg, rating_count, popularity.

**product_variants** — id, product_id, sku (unique), size, color_hex, color_name, price_override_cents, weight_grams, position.

**inventory** — id, variant_id (unique), quantity_on_hand, reserved, reorder_level, restock_at. (Available = on_hand − reserved.)

**carts / cart_items** — cart(id, user_id nullable, anonymous_id, currency, updated_at); cart_item(id, cart_id, variant_id, custom_design_id nullable, quantity, unit_price_cents snapshot).

**orders** — id, order_number (unique, human-readable), user_id (nullable for guest), email, status (enum, see §3.3), currency, subtotal_cents, discount_cents, tax_cents, shipping_cents, total_cents, coupon_id, shipping_address (JSONB snapshot), billing_address (JSONB snapshot), placed_at, notes, idempotency_key (unique).

**order_items** — id, order_id, variant_id, custom_design_id, product_snapshot (JSONB: name/size/color/sku/image), unit_price_cents, quantity, line_total_cents.

**order_status_history** — id, order_id, from_status, to_status, actor (system/admin/customer), note, created_at.

**payments** — id, order_id (unique), provider (`payhere|stripe|ezcash|bank_transfer|cod`), method, status (`pending|authorized|paid|failed|refunded|charged_back`), amount_cents, currency, provider_ref, receipt_asset_id (bank transfer), verified_by, verified_at, idempotency_key.

**payment_events** — id, payment_id, type, raw_payload (JSONB), signature_ok, created_at. (Webhook ledger.)

**coupons** — id, code (unique), type (`percent|fixed|free_ship`), value, min_subtotal_cents, max_redemptions, per_user_limit, starts_at, ends_at, eligible_collection, active.

**coupon_redemptions** — id, coupon_id, user_id, order_id, amount_cents, created_at.

**custom_designs** — id, user_id (nullable), garment_type, garment_color, status, total_cents, spec (JSONB: zones, text, font, colors, scale, positions), created_at, reorder_of_id.

**design_assets** — id, custom_design_id, kind (`source_upload|preview|production_ready`), s3_key, mime, width_px, height_px, dpi, file_size.

**shipments** — id, order_id (unique), method (`speed_post|standard|express|pickup`), courier, tracking_number, label_asset_id, status, shipped_at, delivered_at, estimated_at.

**shipment_events** — id, shipment_id, status, description, location, created_at.

**reviews** — id, product_id, user_id, order_id (for verified-buyer), rating (1–5), title, body, photos[] (s3 keys), status (`pending|published|rejected`), created_at.

**notifications** — id, user_id, type, title, body, read_at, created_at.

**loyalty_accounts / loyalty_transactions** — points balance, tier; ledger of earn/spend/expire with order references.

**store_credits** — id, user_id, balance_cents, reason, expires_at.

**support_tickets / ticket_messages** — ticket(id, user_id, subject, status, priority); message(id, ticket_id, author, body, attachments[]).

**email_queue** — id, to, template, payload (JSONB), status (`queued|sending|sent|failed`), attempts, scheduled_at, sent_at, error. (Transactional outbox.)

**admin_users** — id, email, password_hash, role (`super_admin|ops|support|production`), status, last_login_at, 2fa_secret.

**audit_logs** — id, actor_type, actor_id, action, entity, entity_id, before (JSONB), after (JSONB), ip, created_at.

**analytics_events** — id, anonymous_id, user_id, name, props (JSONB), url, referrer, device, country, created_at. (Or stream to a dedicated analytics tool — see §11.)

### 3.3 Order status state machine

```
created → awaiting_payment → paid → in_production → printing
   → quality_check → ready_to_ship → shipped → delivered
                         └→ cancelled / refunded / on_hold (side states)
```
Non-custom orders skip `printing`/`quality_check`. Every transition writes an
`order_status_history` row and may trigger an email (§7).

### 3.4 Money & data rules

- **Store money as integer cents** (`*_cents`, currency `LKR`). Never floats.
- **Snapshot** product name/price/size/color and addresses **onto the order** at
  purchase time so later catalog edits don't rewrite history.
- All tables: `created_at`, `updated_at`; soft-delete (`deleted_at`) where needed.

---

## 4. Backend architecture

### 4.1 Recommended stack

| Concern | Choice | Why |
|--------|--------|-----|
| Runtime | **Node.js 20 + Express** (TypeScript in production) | Same language as the frontend; huge ecosystem; the scaffold uses it |
| ORM | **Prisma** | Type-safe, great migrations, readable schema |
| Database | **PostgreSQL 16** (managed: Neon/RDS/Supabase) | Relational integrity for orders/payments |
| Cache/queue/sessions | **Redis** | Rate limiting, session store, BullMQ job queue |
| Object storage | **S3 / Cloudflare R2** | Artwork, receipts, shipping labels, review photos |
| Email | **Resend or Amazon SES** | Transactional email + templates |
| SMS | **Notify.lk / Twilio** | Shipping/tracking SMS (SL-friendly) |
| Payments | **PayHere** (LKR, cards + eZ Cash) + optional Stripe | Local gateway, supports SL methods |
| Background jobs | **BullMQ** (Redis) | Email queue, abandoned cart, label generation, points |

> **Faster alternative:** **Supabase** gives Postgres + Auth (incl. Google) +
> Storage + Edge Functions out of the box and can compress weeks of Phase 1–2.
> Trade-off: less control than a bespoke Express API. Both paths are valid; this
> blueprint uses the Express path because it is the most transferable.

### 4.2 Service layout (modular monolith first)

```
backend/
  prisma/schema.prisma         # source of truth for the DB
  src/
    server.js                  # app bootstrap, middleware chain
    config/env.js              # validated env
    lib/{prisma,redis,logger,jwt,hash,ids}.js
    middleware/{auth,admin,error,rateLimit,validate,idempotency}.js
    modules/
      auth/      (routes, service, schema)
      users/     (profile, addresses)
      catalog/   (products, categories, search)
      cart/
      orders/    (create, list, status machine)
      payments/  (providers/*, webhooks, refunds)
      coupons/
      designs/   (uploads, production files)
      shipping/  (rates, labels, tracking)
      reviews/
      loyalty/
      support/
      admin/     (dashboard, reports)
      analytics/
    jobs/        (email worker, abandoned-cart, label, points)
    emails/      (templates + renderer)
```

Start as **one deployable** (modular monolith). Split modules into services
only when traffic or team size demands it.

### 4.3 Request lifecycle

`HTTPS → CORS allowlist → rate limit → body parse → request id/logging →
auth (JWT) → validation (Zod) → controller → service (business logic) →
Prisma (transaction) → response`. Errors funnel through one error middleware
that maps to safe JSON; jobs are pushed to Redis/BullMQ, never run inline.

### 4.4 Environments & deploy

- **Local** (Docker compose: postgres + redis), **staging**, **production**.
- API on Render/Railway/Fly; Postgres + Redis managed; S3/R2 bucket; secrets in
  the platform's secret store. Frontend stays on GitHub Pages (or Cloudflare
  Pages) and points at `https://api.zeroclothing.lk`.
- CI: lint → typecheck → test → `prisma migrate deploy` → deploy.

---

## 5. API architecture

REST, JSON, versioned under `/api/v1`. Auth via `Authorization: Bearer <jwt>`.
All mutating order/payment calls accept an `Idempotency-Key` header.

### 5.1 Endpoint surface (representative)

**Auth**
```
POST   /api/v1/auth/signup
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/verify-email        { token }
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/forgot-password     { email }
POST   /api/v1/auth/reset-password      { token, password }
GET    /api/v1/auth/google              -> OAuth redirect
GET    /api/v1/auth/google/callback
GET    /api/v1/auth/me
```

**Catalog (public)**
```
GET    /api/v1/products?cat=&collection=&size=&color=&sort=&page=
GET    /api/v1/products/:slug
GET    /api/v1/categories
GET    /api/v1/products/:id/reviews
POST   /api/v1/products/:id/reviews     (auth, verified-buyer)
```

**Cart**
```
GET    /api/v1/cart
POST   /api/v1/cart/items               { variantId, qty, customDesignId? }
PATCH  /api/v1/cart/items/:id           { qty }
DELETE /api/v1/cart/items/:id
POST   /api/v1/cart/merge               (on login, merge guest cart)
```

**Checkout / orders**
```
POST   /api/v1/checkout/quote           { items, couponCode?, shippingMethod, address }
POST   /api/v1/orders                    (Idempotency-Key) -> creates order + payment intent
GET    /api/v1/orders                    (auth) order history
GET    /api/v1/orders/:number            (auth or guest token)
GET    /api/v1/orders/:number/tracking   (public-ish via token)
```

**Payments**
```
POST   /api/v1/payments/:orderId/intent  -> gateway session
POST   /api/v1/payments/webhook/payhere  (signature verified, public)
POST   /api/v1/payments/:orderId/receipt (bank transfer upload)
POST   /api/v1/admin/payments/:id/verify (admin)
POST   /api/v1/admin/payments/:id/refund (admin)
```

**Designs / uploads**
```
POST   /api/v1/uploads/sign              -> presigned S3 PUT URL
POST   /api/v1/designs                    { spec, assetKeys }
GET    /api/v1/designs                     (auth) saved designs
POST   /api/v1/designs/:id/reorder
```

**Account**
```
GET/PATCH /api/v1/me
GET/POST/PATCH/DELETE /api/v1/me/addresses
GET/POST/DELETE       /api/v1/me/wishlist
GET    /api/v1/me/notifications
GET    /api/v1/me/loyalty
```

**Support**
```
POST   /api/v1/support/tickets
GET    /api/v1/support/tickets           (auth)
POST   /api/v1/contact                   (public contact form -> ticket + email)
```

**Admin** (all under `/api/v1/admin`, role-guarded)
```
GET  /orders  ·  PATCH /orders/:id/status  ·  GET /customers  ·
CRUD /products /variants /inventory /coupons  ·  GET /payments  ·
POST /shipments/:orderId/label  ·  GET /tickets  ·  GET /analytics  ·
GET  /reports/export?type=orders&from=&to=
```

### 5.2 Conventions

- **Validation:** Zod schema per route; 422 on failure with field errors.
- **Errors:** `{ error: { code, message, details? } }`; never leak stack/SQL.
- **Pagination:** cursor or `page`/`limit`, `X-Total-Count`.
- **Idempotency:** store key→response for 24h to make retries safe.
- **Rate limits:** auth 10/min/IP; webhooks unlimited but signature-checked; general 100/min/IP.

---

## 6. Authentication system

### 6.1 Model

- **Access token:** JWT, 15 min, signed (RS256/HS256), carries `sub`, `role`.
- **Refresh token:** opaque, 30 days, **rotating**, stored hashed in `refresh_tokens`; "Remember me" extends lifetime; logout revokes.
- **Passwords:** `argon2id` (or bcrypt cost ≥ 12). Never stored or logged in plaintext.
- **Sessions:** stateless access + server-tracked refresh (revocable).

### 6.2 Flows

- **Sign up** → validate → create user (`email_verified_at = null`) → enqueue verification email → return tokens (limited until verified).
- **Verify email** → token (hashed, 24h) → set `email_verified_at` → welcome email.
- **Login** → verify hash → issue tokens → `last_login_at`; lockout after N failures (Redis counter).
- **Forgot/reset** → always respond 200 (no user enumeration) → if exists, enqueue reset email with single-use token (1h) → reset sets new hash + revokes sessions.
- **Google login** → OAuth 2.0; match/create by `google_id`/email; mark verified.
- **Account security** → password change re-auth, session list + "log out everywhere", optional TOTP 2FA.

### 6.3 Frontend integration (replaces the fake account page)

`account.html` must be **guarded**: on load call `GET /auth/me`; if 401, redirect to a real login/signup view. All the hardcoded "Nimal Perera" data is replaced by API responses.

---

## 7. Email automation flows

Emails are **enqueued** to `email_queue` and sent by a worker (retries with
backoff). Templates are MJML/HTML with a shared ZERØ layout (logo, dark theme).

| Trigger (event) | Template | Channel |
|-----------------|----------|---------|
| Sign up | `verify-email` | Email |
| Email verified | `welcome` | Email |
| Password reset requested | `password-reset` | Email |
| Password changed | `security-alert` | Email |
| Order placed | `order-confirmation` | Email |
| Payment confirmed / receipt verified | `payment-confirmed` | Email |
| Production started (custom) | `production-started` | Email |
| Shipped (+ tracking #) | `order-shipped` | Email + SMS |
| Delivered | `order-delivered` | Email |
| Refund issued | `refund-issued` | Email |
| Support ticket update | `ticket-update` | Email |
| Abandoned cart (after 1h / 24h) | `abandoned-cart` | Email |

Flow: `domain event → enqueue(template, payload) → worker renders → provider
send → mark sent / retry`. All sends are logged for audit; respect marketing
opt-in for non-transactional mail.

---

## 8. Payment integration architecture

### 8.1 Principles

- The browser **never** sends raw card numbers to our API. Use the gateway's
  hosted/SDK tokenization (PCI scope minimized).
- Money is authoritative **on the server**: re-quote subtotal/discount/tax/
  shipping at order time; ignore client-sent totals.
- Every order create is **idempotent** (`Idempotency-Key` + unique
  `idempotency_key` column) to prevent duplicate charges on retry/double-click.

### 8.2 Methods & flows

**Cards / eZ Cash (via PayHere, LKR):**
```
client → POST /orders (status awaiting_payment)
       → POST /payments/:order/intent  → gateway session/redirect
       → customer pays on gateway
       → gateway → POST /payments/webhook/payhere (SIGNED)
          → verify signature → mark payment paid → order paid
          → enqueue order-confirmation + payment-confirmed
```
Client "success" redirect is **never** trusted for fulfillment — only the
verified webhook flips the order to `paid`.

**Bank transfer:**
```
order awaiting_payment → customer uploads receipt (presigned S3)
→ payment.status=pending, receipt_asset_id set
→ admin reviews in dashboard → verify → paid (or reject → notify)
```

**Cash on delivery:** order `paid_on_delivery` flag; courier collects; reconcile on delivery; optional COD fee.

**Refunds:** admin action → gateway refund API (or manual for bank/COD) →
`payment.status=refunded` → `refund-issued` email → loyalty/credit adjustments.

**Chargebacks:** webhook → mark `charged_back`, open internal task, attach evidence.

**Duplicate prevention:** idempotency keys, unique `payment.order_id`, webhook
event de-dup by `provider_ref` in `payment_events`.

---

## 9. Admin dashboard architecture

A separate authenticated app (React/Next admin or server-rendered) consuming the
`/api/v1/admin` surface. Role-based (`super_admin|ops|support|production`).

**Modules**
- **Orders:** list/filter/search, detail with full snapshot, change status (drives state machine + emails), add notes, issue refunds.
- **Customers:** profiles, order history, lifetime value, segments, notes.
- **Catalog:** product/variant CRUD, images, pricing/sale scheduling, publish/draft.
- **Inventory:** stock per variant, adjustments, low-stock & reorder views.
- **Coupons:** create/limit/expire, redemption reports.
- **Payments:** verify bank receipts, view gateway status, refunds, reconciliation.
- **Shipping:** generate labels, assign couriers, push tracking numbers.
- **Production (custom):** queue of custom orders, download production-ready files, mark printing/QC done.
- **Support:** ticket inbox, reply (emails customer), statuses.
- **Content:** hero/featured/announcement managed via DB (frontend reads a content endpoint).
- **Analytics & reports:** dashboards + CSV/XLSX export.
- Every admin mutation writes an **audit_log** row.

---

## 10. Customer account architecture

Backed entirely by the API (no more hardcoded data).

- **Guest vs returning:** anonymous cart via `anonymous_id` cookie; on login, `POST /cart/merge` merges guest cart, then personalization kicks in (recommendations, saved cart/wishlist/designs, past orders, loyalty).
- **Dashboard:** real counts from `orders`, `wishlist_items`, `loyalty_accounts`.
- **Order history & tracking:** `GET /orders`, `GET /orders/:number/tracking` (real `shipment_events`).
- **Addresses / payment methods:** CRUD; cards stored as gateway tokens only.
- **Saved designs:** server-stored `custom_designs` + S3 assets; one-click reorder.
- **Notifications / rewards / coupons / store credit:** from their tables.
- **Settings & security:** profile edit, password change, sessions, marketing opt-in (PDPA-compliant).

---

## 11. Shipping workflow (Sri Lanka)

**Address model** (already collected in checkout UI; persist + validate):
name, phone, line1, line2, city, **district** (25), **province** (9), postal_code, country=`LK`.

**Methods:** Speed Post, Standard, Express, Store Pickup (Colombo 05). Rates by
weight/destination with **free shipping over Rs 15,000** (server-enforced, not
the current client-only check).

**Flow**
```
paid → (custom? production → QC) → ready_to_ship
→ admin generates label (courier API or PDF) → tracking_number saved
→ status shipped → order-shipped email + SMS with tracking
→ courier webhooks/poll → shipment_events → delivered → delivered email
```

Integrate a courier (Domex / Koombiyo / SL Post). Tracking page reads real
`shipment_events` instead of the current hardcoded timeline.

---

## 12. Production workflow for custom clothing

The studio in `customize.html` currently keeps artwork as base64 in
`localStorage`. Replace with a real pipeline:

```
1. Upload: client requests presigned URL → PUTs file to S3 (validated:
   type, size ≤ 25MB, dimensions, virus scan).
2. Persist design: POST /designs with spec JSON (garment, zones, text, font,
   colors, scale, x/y positions) + asset keys.
3. Generate production-ready file (job): flatten to print spec —
   CMYK/transparent PNG or PDF at 300 DPI, sized to the chosen print zone,
   with bleed/safe-area; store as design_asset kind=production_ready.
4. Attach to order: order_item.custom_design_id links the design + assets.
5. Production queue (admin): printer downloads production file, marks
   printing → quality_check → done (drives status + emails).
6. Reorder: saved design + assets cloned to a new cart line.
```

Validation at upload: min resolution/DPI warning, color profile note, max
file size, allowed formats (PNG/JPG/SVG/PDF), and content moderation hook.

---

## 13. Security checklist

**Application**
- [ ] Input validation (Zod) on every endpoint; reject unknown fields.
- [ ] **SQL injection:** Prisma parameterizes; never string-concat SQL.
- [ ] **XSS:** escape all user content on render; set CSP; the studio must sanitize text (it already escapes in `renderDesign`, keep it).
- [ ] **CSRF:** SameSite=strict cookies for refresh token; CSRF token for cookie-based forms; Bearer JWT for API.
- [ ] **Auth:** argon2id hashing, lockout/backoff, no user enumeration, rotating refresh tokens, short access tokens.
- [ ] **Rate limiting** on auth, checkout, uploads, contact (Redis).
- [ ] **Idempotency** on orders/payments.
- [ ] **File uploads:** presigned, type/size checks, store outside web root (S3), virus scan, never execute.
- [ ] **Payments:** verify webhook signatures; never trust client totals; PCI scope minimized via tokenization.

**Infrastructure / data**
- [ ] HTTPS everywhere, HSTS; secrets in a vault (never in repo).
- [ ] Encrypt at rest (DB, S3) and in transit; least-privilege DB user.
- [ ] CORS allowlist (only the ZERØ frontend origins).
- [ ] Security headers (helmet): CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- [ ] **Admin access control:** RBAC, 2FA, IP allowlist optional, full audit logs.
- [ ] Backups + tested restore; PITR on Postgres.
- [ ] PDPA/GDPR: consent, data export/delete, retention policy, PII minimization.
- [ ] Dependency scanning, logging/alerting, error monitoring (Sentry).
- [ ] Fraud signals: velocity checks, mismatched billing/shipping, COD abuse list.

---

## 14. Step-by-step implementation plan

Phased so the store can start taking **real, paid, fulfilled orders** as early
as possible, then layer on sophistication.

### Phase 0 — Foundation (this PR)
- ✅ Decide stack & topology (done above).
- ✅ `backend/` scaffold: Express app, Prisma schema for all tables, auth
  (signup/login/verify/forgot/reset) + orders create + health, middleware
  (auth, error, rate limit), email-queue stub, `.env.example`, README.
- Provision Postgres + Redis + S3 + email provider (staging).
- `prisma migrate` to create the schema.

### Phase 1 — Identity & catalog (MVP-A)
- Wire real auth end-to-end; guard `account.html`; build login/signup UI.
- Seed products from `data.js` into DB; expose `GET /products`; switch shop &
  product pages to the API; real reviews + inventory truth.

### Phase 2 — Cart, checkout & payments (MVP-B — "can take money")
- Server cart + merge on login; `POST /checkout/quote` (authoritative totals + tax + shipping + coupon engine).
- Integrate **PayHere** (cards + eZ Cash) with signed webhooks; bank-transfer receipt upload + admin verify; COD.
- Idempotent `POST /orders`; persist full snapshot; `order-confirmation` + `payment-confirmed` emails.
- **Milestone: real orders are stored and paid.**

### Phase 3 — Fulfillment & comms
- Order status state machine + history; admin order management.
- Shipping: label generation + tracking numbers; real tracking page; shipped/delivered emails + SMS.
- Transactional email worker for all 12 triggers; abandoned-cart job.

### Phase 4 — Custom production pipeline
- Presigned uploads; persist designs + assets; production-ready file job; production queue in admin; saved designs + reorder in account.

### Phase 5 — Admin, loyalty & analytics
- Full admin dashboard (customers, inventory, coupons, payments, tickets, content, reports/export).
- Loyalty points/tiers, store credit, coupon limits.
- Analytics events + dashboards (visitors, conversion, AOV, cart abandonment, top products, retention, sources, devices, locations).

### Phase 6 — Hardening & scale
- Full security checklist, load testing, caching/CDN, observability, backups/DR, PDPA compliance, on-call runbooks.

### What the existing frontend must change (integration notes)
- Replace `window.ZERO.store` (localStorage) reads/writes for cart, orders,
  designs, account with `fetch` calls to `/api/v1/*`.
- Add a real auth/session layer and guard `account.html`.
- Move catalog from `data.js` to `GET /products`.
- Remove the fake order-number/`setTimeout` logic in `checkout.js`/`tracking.js`.
- Keep all the existing UI/markup — only the data source changes.

---

*Generated as part of the ZERØ CLOTHING backend architecture engagement. The
runnable starting point lives in [`/backend`](../backend).*
