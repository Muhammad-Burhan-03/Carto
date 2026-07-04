# Deployment Guide — Vercel + Neon PostgreSQL

## Architecture
- **Frontend**: static files in `public/` (unchanged UI — `index.html`,
  `script.js`, `style.css`, `js/api.js`, images), served directly by Vercel's
  CDN.
- **Backend**: a single Vercel serverless function at `api/[...slug].js`,
  which matches every request under `/api/*` and hands it to the shared
  Express app in `api/_app.js` (Express apps are natively callable as
  `(req, res)` handlers, so no adapter package is needed).
- **Database**: Neon PostgreSQL (serverless Postgres), connected via
  `DATABASE_URL`.

## 1. Database setup (Neon)
Either:
- **Via Vercel's Storage tab** (easiest): your project → **Storage** →
  **Connect Database** → **Neon** → follow the prompts. Vercel injects the
  connection string automatically (as `DATABASE_URL` or `POSTGRES_URL` —
  both are checked by `db/index.js`).
- **Or manually**: sign up free at https://neon.tech → create a project →
  copy the connection string → set it as `DATABASE_URL` in your Vercel
  project's environment variables yourself.

Then run the migrations from your own machine (there's no auto-apply step
on Vercel, unlike Netlify DB):
```bash
git clone https://github.com/Muhammad-Burhan-03/Carto.git
cd Carto
npm install
DATABASE_URL="<your-neon-connection-string>" node db/migrate.js
DATABASE_URL="<your-neon-connection-string>" node db/hash-demo-passwords.js
```
This creates all 16 tables (3NF schema, FKs, indexes), seeds 3 packages, 7
categories, 2 brands, a demo seller + user, and 20 demo products.

## 2. Vercel project setup
1. https://vercel.com/new → **Import Git Repository** → select `Carto`.
2. Framework preset: **Other** (it's a static frontend + serverless API,
   not a frontend framework).
3. Vercel will read `vercel.json` automatically:
   - Static assets served from `public/`
   - `api/**/*.js` deployed as serverless functions

## 3. Environment variables
Set these in **Project Settings → Environment Variables**:

| Variable | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | From step 1 (may already be set if using the Neon integration) |
| `JWT_SECRET` | Yes | Long random string, e.g. `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | No | Defaults to `7d` |
| `ALLOWED_ORIGIN` | No | Defaults to `*`; set to your production URL once known |

## 4. Deploy
Click **Deploy**. Vercel builds and serves the frontend as static files and
deploys `api/[...slug].js` as a serverless function automatically — no
build step is required for either half.

## 5. Verify
```
GET https://<your-project>.vercel.app/api/health
```
Expect `{"status":"ok","database":"connected"}`. If you get
`"database":"unreachable"`, double check `DATABASE_URL` and that migrations
were run.

## Login for testing
- User: `user@demo.com` / `123456`
- Seller: `admin@demo.com` / `123456`

## Notes on this architecture
- All 39 API routes are handled by **one** serverless function
  (`api/[...slug].js` → `api/_app.js`), not one function per route. This
  keeps cold starts to a minimum and avoids Vercel's per-function overhead
  multiplying 39x.
- `api/_app.js` has zero Vercel-specific code in it — it's a plain Express
  app. This is deliberate: the same file could be dropped into any
  Express-compatible host (a plain Node server, Render, etc.) with one line
  of glue code, without touching business logic.
- Product/store-logo images are stored as base64 data URIs directly in
  Postgres (`products.image`, `sellers.store_logo`), matching the original
  frontend-only app's approach. Swapping this for real object storage
  (e.g. Vercel Blob) is a reasonable future improvement but wasn't part of
  the current scope.
