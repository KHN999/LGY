# Deploying LGY

**Stack:** Web (Next.js) → **Vercel** · API (NestJS) + PostgreSQL → **Railway**.

Why split: Next.js is built for Vercel (CDN + SSR); the API is a long-running
process with a DB connection pool that belongs next to Postgres (same region =
low per-query latency). Keep the API and DB together; the web talks to the API.

---

## 0. A JWT secret (run in YOUR terminal, never share it)
```bash
openssl rand -base64 48
```
Login tokens are signed with this. Anyone who has it can forge a session as any
user. Use a strong random value, different from dev.

---

## 1. Railway — Postgres + API

1. **New project → add PostgreSQL.** Managed DB = backups + a stable URL.
2. **New service → from GitHub repo `KHN999/LGY`.**
   - **Build command:**
     ```
     pnpm install --frozen-lockfile && pnpm --filter @lgy/db build && pnpm --filter @lgy/api build
     ```
     `@lgy/db` is built first because the API imports its generated Prisma
     client; `--frozen-lockfile` pins exact tested versions; `prisma generate`
     (inside `@lgy/db build`) produces the Linux query engine on the platform.
   - **Start command:** `node apps/api/dist/main.js` (runs compiled JS).
3. **Variables:**
   | Key | Value | Why |
   |---|---|---|
   | `NODE_ENV` | `production` | turns on the `secure` (HTTPS-only) auth cookie |
   | `JWT_SECRET` | *(step 0)* | signs/verifies sessions |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | reference, no `?schema=` — the API appends `public`/`playground` itself |
   | `WEB_ORIGIN` | *(Vercel URL, after step 3)* | CORS allow-list (defensive) |

   The API binds to `process.env.PORT` (Railway injects it) on `0.0.0.0`.

Deploy, then copy the API's **public URL** → this is `API_URL`.

---

## 2. Initialize the database (once)
Get the Postgres **public** connection string from Railway, then in YOUR terminal:
```bash
export DATABASE_URL='postgresql://…railway-public…'
SEED_ADMIN_PASSWORD='your-real-password' pnpm --filter @lgy/db deploy:init
unset DATABASE_URL
```
`deploy:init` = `migrate deploy` (build the schema) + `seed` (1 admin, item
types, expense categories — **no demo data on main**) + `setup:shop playground`
(the Test sandbox schema, with demo data). Migrations make the empty tables;
the seed inserts the first rows — without it there's no admin and you can't log in.

> `migrate deploy` (not `migrate dev`) = non-interactive, applies committed
> migrations in order, never resets. The production-safe command.

---

## 3. Vercel — the web app
1. **Import `KHN999/LGY`. Root Directory: `apps/web`.** Framework: Next.js.
   Build stays `next build` (the web doesn't import `@lgy/db`, so no extra steps).
2. **Variables:**
   | Key | Value | Why |
   |---|---|---|
   | `API_URL` | *(Railway API URL)* | `next.config.ts` rewrites `/api/*` → `${API_URL}/api/*` |
   | `NEXT_PUBLIC_LOCALE` | *(unset)* | defaults to Burmese; `NEXT_PUBLIC_*` is baked in at build time |

   **Why the proxy:** the browser calls same-origin `/api/*`; Next forwards it to
   the API server-side. The auth cookie is `httpOnly; sameSite=lax`, which the
   browser only sends same-site — a direct cross-domain call to Railway would
   drop it (instant logout). The proxy makes everything one origin, so the cookie
   works and CORS never applies (the Vercel→Railway hop is server-to-server).

Deploy, copy the Vercel URL.

---

## 4. Connect them
Set `WEB_ORIGIN` on the Railway API = the Vercel URL → redeploy the API.
(Chicken-and-egg: the web needs the API URL and the API needs the web URL, so
deploy the API first, point the web at it, then backfill `WEB_ORIGIN`.)

---

## 5. Smoke test
1. Open the Vercel URL → Burmese login screen.
2. Log in as `kaung` → **change your password** in Users (rotates the seeded one).
3. Create staff accounts (each person logs in as themselves → audit trail).
4. Confirm the banner shows **Main**, not Test.
5. Enter **opening stock** (Admin → Opening stock) — the snapshot-the-shelf cutover.
6. Do one test sale → print → then **void** it (leaves real numbers at zero).

---

## Future changes
- Code: push to `main`; Railway + Vercel redeploy.
- New DB migration: rerun `migrate deploy` **and** `setup:shop playground` so both
  schemas get it.
- Switch UI language: `NEXT_PUBLIC_LOCALE` (`my` Burmese default, `en` English).
