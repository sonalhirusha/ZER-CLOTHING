# ZERØ CLOTHING — API (backend foundation)

This is the **runnable starting point** for the ecommerce backend described in
[`../docs/ECOMMERCE-ARCHITECTURE.md`](../docs/ECOMMERCE-ARCHITECTURE.md).

It implements the first vertical slice end-to-end so the rest can be built on a
proven pattern:

- **Auth** — signup, login, logout, refresh (rotating tokens), email
  verification, forgot/reset password. Passwords hashed with argon2id; access
  tokens are short-lived JWTs; refresh tokens are random and stored hashed.
- **Catalog** — `GET /products`, `GET /products/:slug`, `GET /categories`,
  `GET /products/:slug/reviews`. Responses are shaped to match the existing
  frontend exactly, so the static site switches to live data with one setting.
- **Checkout/Orders** — `POST /checkout/quote` and idempotent `POST /orders`
  with **server-authoritative pricing** (client totals are ignored), stock
  reservation, order-number generation, and an order-confirmation email enqueue.
- **Seed** — `prisma/seed.js` loads the same catalog the site ships with, plus
  the `ZERO10` / `FREESHIP` coupons and a super-admin user.
- **Cross-cutting** — Helmet, CORS allowlist, rate limiting, Zod validation,
  centralised error handling, transactional email outbox.

The full database for **every** required table (users, orders, products,
inventory, payments, shipping, coupons, custom designs, support, audit logs,
email queue, analytics, …) is defined in
[`prisma/schema.prisma`](prisma/schema.prisma).

> Everything else (payments gateway, admin dashboard, shipping labels,
> production-file pipeline, analytics, loyalty) is specified in the architecture
> doc and is intended to be built module-by-module following the same structure
> under `src/modules/*`.

## Requirements

- Node.js 20+
- PostgreSQL 16 (local or managed)
- (Later) Redis, an S3-compatible bucket, an email provider, PayHere account

## Quick start

```bash
cd backend
cp .env.example .env          # then fill in DATABASE_URL + secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates all tables
npm run seed                  # loads the catalog, coupons + admin user
npm run dev                   # http://localhost:4000/health
```

## Connect the live site to this API

The static frontend ships in **offline mode** (`window.ZERO.API_BASE === ""`) so
it works on GitHub Pages with bundled demo data. To switch the whole site to the
live backend, set the base URL **before** `app.js` loads — e.g. add this to each
page (or inject it globally):

```html
<script>window.ZERO_API_BASE = "https://api.zeroclothing.lk/api/v1";</script>
```

Once set, `ZERO.loadProducts()` pulls the catalog from `/products`, checkout
POSTs to `/orders`, tracking reads `/orders/:number/tracking`, and contact posts
to `/contact` — all with automatic fallback if a request fails.

## Try it

```bash
# health
curl localhost:4000/health

# sign up
curl -X POST localhost:4000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.lk","password":"supersecret","firstName":"Sonal"}'

# quote a cart (variantId values come from your seeded catalog)
curl -X POST localhost:4000/api/v1/checkout/quote \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"variantId":"<id>","quantity":1}],"shippingMethod":"standard"}'
```

## Project layout

```
prisma/schema.prisma     complete database schema (all tables)
src/
  server.js              app bootstrap + middleware chain
  config/env.js          validated environment
  lib/                   prisma, jwt, hash, ids
  middleware/            auth, error, rateLimit, validate
  services/email.js      transactional email outbox (enqueue)
  modules/
    auth/                signup/login/verify/reset (implemented)
    catalog/             products/categories/reviews (implemented)
    orders/              quote + idempotent order create (implemented)
    ...                  payments, shipping, admin (to build)
```

## How the existing site connects

The static frontend (this repo's root) keeps its UI and markup; only its data
source changes from `localStorage` to this API. See "What the existing frontend
must change" in the architecture doc. Point the frontend at
`https://api.zeroclothing.lk/api/v1` (or `http://localhost:4000/api/v1` in dev).

## Security notes

- Never collect raw card numbers — use the payment gateway's tokenization.
- Order/payment totals are always recomputed on the server.
- Webhooks must be signature-verified before changing order state.
- Secrets live only in `.env` / the platform secret store, never in git.



---

## Full stack status (June 2026 rebuild)

The API is now a complete commerce backend. It runs out of the box on **SQLite**
(zero external infra) and is portable to **PostgreSQL** for production (change
`provider` in `prisma/schema.prisma` and set `DATABASE_URL`).

### Quick start (local)

```bash
cd backend
cp .env.example .env          # sensible dev defaults already work
npm install
npm run setup                 # prisma generate + migrate deploy + seed
npm start                     # http://localhost:4000  (GET /health)
npm run test:e2e              # 27 end-to-end checks (server must be running)
# or run server + tests in one process:
node tests/local.js
```

Seed creates the 12-product catalog (91 variants + inventory), two coupons
(`ZERO10`, `FREESHIP`) and an admin (`admin@zeroclothing.lk` / `Admin123!`).

### Endpoints

| Area | Routes |
|---|---|
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `GET/POST /auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` |
| Catalog | `GET /products`, `/products/:slug`, `/categories`, `/products/:slug/reviews` |
| Account | `GET /account/overview`, `PATCH /account/profile`, `POST /account/change-password`, addresses CRUD, wishlist CRUD, notifications |
| Orders | `POST /checkout/quote`, `POST /orders`, `GET /orders`, `GET /orders/:n`, `GET /orders/:n/tracking` |
| Payments | `POST /payments/card`, `POST /payments/:n/receipt` (upload), `GET /payments/:n`, `POST /payments/payhere/notify` |
| Designs | `POST /designs`, `POST /designs/:id/artwork` (upload), `GET /designs`, `GET /designs/:id`, `POST /designs/:id/reorder` |
| Support | `POST /contact`, `POST /newsletter` |
| Analytics | `POST /analytics/track` |
| Admin | `POST /admin/login`, `GET /admin/analytics`, orders + status + shipment, payments verify/refund, customers, products CRUD, inventory, support tickets |

### Email

Emails are queued in `EmailQueue` and sent by an in-process worker with retries.
With no `SMTP_HOST`, emails are written as `.eml` previews to `backend/var/mail`
(so you can see every message). Set SMTP env vars to send for real. Templates:
verify-email, welcome, password-reset, security-alert, order-confirmation,
payment-confirmed, production-started, order-shipped, order-delivered,
refund-issued, ticket-update, abandoned-cart.

### Connecting the storefront

The static site auto-detects the API base:
1. `window.ZERO_API_BASE` if set, else
2. `<meta name="zero-api-base" content="https://api.example.com/api/v1">`, else
3. `http://localhost:4000/api/v1` on localhost, else static demo mode.

To make the deployed GitHub Pages site use the live API, add the meta tag to the
`<head>` of each page pointing at your deployed API URL.

### Production env checklist

- `NODE_ENV=production`
- `DATABASE_URL` (SQLite file path on a persistent disk, or a Postgres URL)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ADMIN_SECRET` (long random)
- `APP_URL`, `SITE_URL`, `CORS_ORIGINS`
- `UPLOAD_DIR` (persistent path)
- `SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM` (to send real email)
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- Optional: `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`

A `render.yaml` blueprint at the repo root deploys this service with a
persistent disk for the database + uploads.
