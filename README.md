# LGY

Textile (longyi) wholesale/retail management system for Theingyi Market.

## Stack

- **Frontend** — Next.js (App Router) + Tailwind + shadcn/ui → Vercel
- **Backend** — NestJS + Prisma → Railway (Singapore region)
- **Database** — Postgres on Railway (locally: Docker)
- **File storage** — Cloudflare R2 (product photos)
- **Auth** — own `users` table, bcrypt + JWT in httpOnly cookie

UI is **Burmese-only**, designed for non-technical shop staff. All UI strings live in `apps/web/src/lib/labels.ts`.

## Layout

```
apps/
  web/        Next.js mobile-responsive site (/admin + /staff)
  api/        NestJS backend (business logic lives here)
packages/
  db/         Prisma schema + generated client
docker-compose.yml   Local Postgres on :5433
.env                 Root env, symlinked into each app
```

## Running locally — first time

Prereqs: Node 20+, pnpm 10+, Docker.

```bash
# 1. Install deps
pnpm install

# 2. Boot Postgres (port 5433 to avoid clashing with any host postgres)
docker compose up -d

# 3. Create .env from the example, then symlink it into each package
cp .env.example .env
# .env already has working defaults for the local docker-compose. Edit if needed.
ln -sf ../../.env apps/api/.env
ln -sf ../../.env apps/web/.env
ln -sf ../../.env packages/db/.env

# 4. Run the initial migration + seed an admin user
pnpm --filter @lgy/db exec prisma migrate dev --name init
pnpm --filter @lgy/db seed

# 5. Build the shared db package (api/web import compiled JS)
pnpm --filter @lgy/db build

# 6. Start everything in dev mode
pnpm dev
# → web on http://localhost:3000
# → api on http://localhost:4000
```

The seed creates one admin: **`kaung` / `changeme123`**. Change immediately if exposing this beyond localhost.

## Running locally — every other day

```bash
docker compose up -d
pnpm dev
```

## Useful scripts

| Command | What |
|---|---|
| `pnpm dev` | Run web + api in parallel |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Typecheck everything |
| `pnpm db:migrate` | Create + apply a new Prisma migration |
| `pnpm db:studio` | Open Prisma Studio (web UI to browse DB) |
| `pnpm --filter @lgy/db seed` | Re-run seed (idempotent — upserts) |
| `docker compose down` | Stop Postgres (data persists in volume) |
| `docker compose down -v` | Stop Postgres AND wipe data |

### Resetting the database (start fresh, no test data)

```bash
docker compose down -v          # wipe Postgres volume
docker compose up -d
pnpm --filter @lgy/db exec prisma migrate deploy
pnpm --filter @lgy/db seed       # admin user + expense categories only
# Skip seed:dev — populate real data via /admin instead.
```

## Auth model

- Login: `POST /api/auth/login` `{ username, password }` → sets httpOnly cookie `lgy_session`, returns `{ user }`.
- Logout: `POST /api/auth/logout` → clears cookie.
- Current user: `GET /api/auth/me` → returns `{ user }` or 401.
- Roles: `User.roles` is `string[]` — values are `'admin' | 'staff' | 'manager'`.
- `/admin` requires `admin` role. `/staff` requires `staff` or `admin`.
- Backend guard: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')` on a controller method.
- Frontend: `getCurrentUser()` from `@/lib/auth-server` in server components; redirect on null.

## Conventions

- **Money**: all monetary columns are `Int` kyat (MMK). No decimals.
- **Time**: `DateTime` (Postgres `timestamp`).
- **Audit**: every transactional row has `createdById -> User`. Voided records use `voidedAt/voidedById/voidReason` instead of being deleted.
- **Burmese strings**: never inline. Add to `apps/web/src/lib/labels.ts` and import.
- **Stock & balances**: computed from raw rows (not cached). Will denormalize later if needed.
