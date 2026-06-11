# ZERØ CLOTHING — API (backend foundation)

This is the **runnable starting point** for the ecommerce backend described in
[`../docs/ECOMMERCE-ARCHITECTURE.md`](../docs/ECOMMERCE-ARCHITECTURE.md).

It implements the first vertical slice end-to-end so the rest can be built on a
proven pattern:

- **Auth** — signup, login, logout, refresh (rotating tokens), email
  verification, forgot/reset password. Passwords hashed with argon2id; access
  tokens are short-lived JWTs; refresh tokens are random and stored hashed.
- **Checkout/Orders** — `POST /checkout/quote` and idempotent `POST /orders`
  with **server-authoritative pricing** (client totals are ignored), stock
  reservation, order-number generation, and an order-confirmation email enqueue.
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
npm run dev                   # http://localhost:4000/health
```

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
    orders/              quote + idempotent order create (implemented)
    ...                  catalog, payments, shipping, admin (to build)
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
