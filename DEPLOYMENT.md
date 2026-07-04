# Carto — Full-Stack Deployment Guide

Carto is now a full-stack app: static frontend (HTML/CSS/vanilla JS) +
Netlify Functions (Express API) + Neon PostgreSQL (Drizzle ORM).

## 1. Create your Neon database
1. Sign up at https://console.neon.tech and create a project (free tier is fine).
2. Copy the connection string it gives you (starts with `postgres://...?sslmode=require`).

## 2. Configure environment variables
Copy `.env.example` to `.env` for local dev, and set the same variables in
**Netlify → Site settings → Environment variables** for production:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | A long random string (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `ALLOWED_ORIGIN` | Your deployed site URL, or `*` for testing |

## 3. Install dependencies and run migrations
```bash
npm install
DATABASE_URL="your-neon-url" npm run db:migrate
DATABASE_URL="your-neon-url" node db/hash-demo-passwords.js   # sets real bcrypt hashes for the demo accounts
```
This creates all 16 tables, indexes, and foreign keys (see `db/migrations/`),
and seeds baseline data: 3 seller packages, 7 categories, 2 brands, a demo
seller + demo user (both login with password `123456`), and 20 demo products.

## 4. Local development
```bash
npm install -g netlify-cli   # if you don't have it
netlify dev
```
This serves the static site and runs the Netlify Functions locally at
`http://localhost:8888`, with `/api/*` proxied to the Express app in
`netlify/functions/api.js`.

## 5. Deploy to Netlify
1. Push this repo to GitHub (already done).
2. In Netlify: **Add new site → Import an existing project** → pick this repo.
3. Build settings are already defined in `netlify.toml` (publish dir `.`,
   functions dir `netlify/functions`). No build command is needed for the
   static assets; `npm install` runs so the function's dependencies are bundled.
4. Add the environment variables from step 2 in the Netlify UI.
5. Deploy. Netlify will bundle `netlify/functions/api.js` (and everything it
   imports from `db/` and `netlify/functions/lib/`) into one Lambda, and
   `/api/*` requests will be routed to it per the redirect in `netlify.toml`.

## Architecture notes
- **One consolidated function** (`netlify/functions/api.js`) handles every
  `/api/*` route via an Express router + `serverless-http`, instead of one
  Lambda per endpoint. Same functionality, fewer cold starts, easier to reason
  about.
- **Auth**: JWT bearer tokens (7-day expiry by default), passwords hashed with
  bcrypt (10 rounds). The frontend keeps the token in `localStorage` — this is
  the one piece of client storage retained, since a stateless JWT session must
  survive page reloads. Every other piece of app data now lives in Postgres.
- **Validation**: every write endpoint validates its body with Zod
  (`netlify/functions/lib/validation.js`) before touching the database.
- **Product images**: the admin UI still uses a plain `<input type="file">`
  with a client-side preview (base64 data URI), since no object storage
  (S3/Cloudinary/etc.) is configured. The base64 string is stored directly in
  the `products.image` / `sellers.store_logo` text columns. For a real
  production deployment you'd swap this for uploads to object storage and
  store just the URL — that's a follow-up, not something achievable without
  additional third-party credentials.

## Verifying your deployment

Once deployed with `DATABASE_URL` set, hit:

```
GET https://<your-site>.netlify.app/api/health
```

- `{"status":"ok","database":"connected", ...}` → the function is live and can reach Neon.
- `{"status":"error","database":"unreachable", ...}` → check that `DATABASE_URL` is set correctly in Netlify's environment variables and that migrations have been run.

This is the fastest way to confirm the backend is wired up correctly before testing the full UI flow (register → browse → cart → checkout).
