# ZERØ CLOTHING — Production Deployment Runbook

## 1. What this project actually is (inspection result)

| Layer | Status |
|---|---|
| **Live site** (`sonalhirusha.github.io/ZER-CLOTHING`) | **Static GitHub Pages** (`server: GitHub.com`). The storefront runs in **"pure static / demo mode"** — `app.js` sets `API_BASE = ""` so no backend is called. |
| **Repository** | Also contains a **complete, un-deployed full-stack backend** at `backend/` — **Express + Prisma** with a schema covering *every* requested table (users, addresses, orders + items + status history, products, variants, inventory, wishlist, cart, payments + events, coupons, loyalty, store credit, **custom designs + assets**, shipments + events, reviews, notifications, support, **email outbox**, admin, audit logs, analytics). |
| **Frontend to backend link** | The storefront flips from demo data to live data by setting one value: a `<meta name="zero-api-base" content="https://YOUR-API/api/v1">` tag (or `window.ZERO_API_BASE`). |

**Conclusion:** It is a **static site whose backend already exists in the repo but was never deployed.** Going live = provision infrastructure + deploy the API + point the storefront at it. The backend was build/seed-verified locally in this environment (migrations applied; 12 products + coupons + admin seeded).

---

## 2. Mapping the requested stack onto this codebase

| Requested | How it maps here |
|---|---|
| **Supabase PostgreSQL** | Prisma connects to Supabase Postgres via `DATABASE_URL`. Change datasource `provider` to `postgresql`, add `directUrl`, run migrations. (no rewrite) |
| **Resend (email)** | The email outbox uses SMTP (nodemailer). Resend exposes SMTP: `smtp.resend.com`. Drop in the creds. (no rewrite) |
| **Supabase Storage** (artwork/receipts) | `backend/src/lib/upload.js` currently writes to local disk (`UPLOAD_DIR`). For Supabase Storage, swap that adapter for the Supabase Storage SDK. Small, isolated code change — flagged, not yet done. |
| **Supabase Auth** | The backend ships its **own** JWT auth (signup/login/logout/refresh/verify/reset) the UI already uses. Keep it (zero rewrite, satisfies all auth requirements) **or** migrate to Supabase Auth (larger change). |
| **Vercel** | This API is a long-running Express server with uploads -> best on **Render/Railway/Fly** (repo already includes `render.yaml`). It can run on Vercel serverless **only after** moving uploads to Supabase Storage. The **static storefront** can stay on GitHub Pages or move to Vercel. |
| **Google Analytics** | Add the `gtag.js` snippet to each page `<head>` with your Measurement ID (snippet in section 6). |

> **Honest note:** Account creation, secret keys, and the actual production deploy require **your** Supabase / Resend / Vercel (or Render) / Google accounts. Those steps are listed below; they cannot be performed without your credentials, and **no production URL is fabricated here.**

---

## 3. Credentials you must create (the only blockers)

1. **Supabase** project -> Settings -> Database -> connection strings (pooled **and** direct), plus Project URL + `anon` + `service_role` keys.
2. **Resend** account -> verify sending domain (`zeroclothing.lk`) -> create an API key.
3. **Render** (recommended for this Express API) **or** Vercel account.
4. **Google Analytics 4** property -> Measurement ID (`G-XXXXXXXXXX`).

---

## 4. Database — point Prisma at Supabase Postgres

In `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (pgBouncer, port 6543)
  directUrl = env("DIRECT_URL")     // direct (port 5432) — for migrations
}
```

Then, from `backend/`:

```bash
npm install
npx prisma migrate deploy   # or: npx prisma db push   (first time on a fresh Supabase DB)
node prisma/seed.js         # loads the 12-product catalog, coupons, admin user
```

> SQLite "JSON-as-text" columns store fine as Postgres `text`; no data-model changes are needed to go live. Tighten to native `jsonb`/`enum` later if you like.

---

## 5. Environment variables

Copy `backend/.env.production.example` -> set these in your host's dashboard (**never commit real secrets**):

- `DATABASE_URL`, `DIRECT_URL` — from Supabase
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ADMIN_SECRET` — long random strings
- `EMAIL_FROM`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASS=<RESEND_API_KEY>`
- `SITE_URL` — storefront URL (used in email links)
- `CORS_ORIGINS` — storefront origin(s), comma-separated
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- *(if moving uploads to Storage)* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_RECEIPTS`, `SUPABASE_BUCKET_ARTWORK`

---

## 6. Deploy

### API (recommended: Render — blueprint already in repo)
1. Push the repo. Render -> **New -> Blueprint** -> select `render.yaml`.
2. Set the `sync:false` env vars (DB URL, CORS, SITE_URL, SMTP creds) in the dashboard.
3. Note the API URL, e.g. `https://zero-clothing-api.onrender.com`.

### Storefront -> point it at the live API
Add to each page `<head>`:
```html
<meta name="zero-api-base" content="https://zero-clothing-api.onrender.com/api/v1">
```
The UI immediately switches from demo data to live auth/orders/payments — **no UI/design changes.**

### Google Analytics — add to each page `<head>`
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','G-XXXXXXXXXX');</script>
```

---

## 7. Smoke test (after deploy)

```bash
API=https://zero-clothing-api.onrender.com/api/v1
curl ${API%/api/v1}/health
curl $API/products | head
curl -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test"}'
curl -X POST $API/auth/login  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```
Then in-browser: sign up -> verify email -> place an order -> upload a receipt -> check the admin dashboard -> confirm Resend delivered welcome + order-confirmation emails.

---

## 8. Remaining code change for the literal stack (optional)
- **Supabase Storage adapter** in `backend/src/lib/upload.js` (replace disk writes with `supabase.storage.from(bucket).upload(...)`). Until then uploads use the host's disk (works on Render via the mounted disk in `render.yaml`).
- **Supabase Auth** migration (optional) — only if you want Supabase to own identity instead of the built-in JWT auth.

This is the lowest-risk path to a fully functional production store **with the existing premium UI 100% intact.**
