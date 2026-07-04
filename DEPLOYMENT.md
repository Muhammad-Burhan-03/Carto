# Deployment Guide

## Live site
- **Production URL:** https://carto-eshop.netlify.app
- **Netlify project:** carto-eshop (linked to this GitHub repo, auto-deploys on push to `main`)

## Database: Netlify Database (Neon under the hood)
This project uses [`@netlify/database`](https://docs.netlify.com/database), which
**auto-provisions a Postgres instance with zero manual setup** — no Neon account,
no manually copying a connection string. On every deploy:

1. Netlify provisions (or reuses) a Postgres database for this site.
2. Every SQL file under `netlify/database/migrations/<name>/migration.sql` is
   applied automatically, in lexicographic order, before the deploy publishes.
3. The connection string is injected automatically — `db/index.js` picks it up
   via `getConnectionString()` from `@netlify/database` (falling back to a
   manually-set `DATABASE_URL` if you prefer to use your own Postgres/Neon
   instance instead).

Migrations included:
- `20260701000001_init` — all 16 tables, foreign keys, indexes (3NF schema)
- `20260701000002_seed` — packages, categories, brands, demo seller + user
  (both log in with password `123456`, real bcrypt hashes baked into the migration)
- `20260701000003_seed_products` — 20 demo products across all categories

There's nothing to run manually — pushing to `main` triggers the whole thing.

> Legacy note: `db/migrations/*.sql` and `db/migrate.js` are kept for anyone who
> wants to run this against their **own** externally-hosted Postgres/Neon
> instance instead of Netlify Database — set `DATABASE_URL` manually if so.

## Environment variables
Set directly on the Netlify site (already configured for the live deployment):

| Variable | Purpose | Required? |
|---|---|---|
| `JWT_SECRET` | Signs/verifies auth tokens | Yes |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) | No |
| `ALLOWED_ORIGIN` | CORS origin for the API | No (defaults to `*`) |
| `DATABASE_URL` | Only needed if bypassing Netlify Database | No |

## Verifying the deployment
```
GET https://carto-eshop.netlify.app/api/health
```
- `{"status":"ok","database":"connected", ...}` → backend + DB fully wired.
- `{"status":"error","database":"unreachable", ...}` → check the latest deploy log in the Netlify UI for migration errors.

## Architecture notes
- **One consolidated Netlify Function** (`netlify/functions/api.js`): an Express
  app wrapped with `serverless-http`, routed via `netlify.toml`
  (`/api/* → /.netlify/functions/api/:splat`). This is the classic
  Lambda-compatible function format, chosen over rewriting 39 routes into
  individual fetch-style functions — same functionality, far less deploy
  overhead, one cold start instead of dozens.
- **Auth**: JWT bearer tokens, bcrypt-hashed passwords (10 rounds). The
  frontend keeps only the JWT in `localStorage` — the one piece of client
  storage retained, since a stateless session must survive page reloads.
  Every other piece of app data lives in Postgres.
- **Validation**: every write endpoint validates its body with Zod
  (`netlify/functions/lib/validation.js`) before touching the database.
- **Product images**: the admin UI uses a plain `<input type="file">` with a
  client-side base64 preview, stored directly in `products.image` /
  `sellers.store_logo`. Swapping this for real object storage (e.g. Netlify
  Blobs) is a reasonable follow-up but wasn't part of the current scope.
