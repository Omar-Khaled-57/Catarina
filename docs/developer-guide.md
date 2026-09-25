# <img src="../public/rina/note.webp" width="90" align="center" /> Developer Guide

How to set up, run, test, modify, and deploy Catarina.

## Quick start

```bash
npm install          # also runs `prisma generate` (postinstall)
cp .env.example .env # fill in DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET
npm run db:setup     # push schema + seed (also works for first-time local dev)
npm run dev          # http://localhost:3000
```

First login: `admin@team.com` / `admin123`. **Change the seeded admin password after first login.**

## Environment variables (`.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_TEAM_NAME` | yes | Team name in nav, footers, PDFs, metadata |
| `NEXT_PUBLIC_SITE_URL` | yes | Deployed URL for SEO/sitemap/OG |
| `DATABASE_URL` | yes | `libsql://…turso.io` connection string |
| `TURSO_AUTH_TOKEN` | yes | Turso auth token |
| `JWT_SECRET` | yes | HS256 signing secret for the `catarina-token` cookie |

> Rate limiting uses the **same** Turso DB (`rate_limit_events` table) — no extra config.
> Without `DATABASE_URL`, the rate limiter falls back to an in-memory Map (dev only).

## Scripts (`package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint (ignores `dev/**` via `eslint.config.mjs`) |
| `npm run test` | Unit tests: `node --import tsx --test "src/**/*.test.ts"` |
| `npm run db:setup` | `prisma db push --env-file=.env` (local) + `db:seed` (Turso) |
| `npm run db:seed` | `tsx --env-file=.env prisma/seed.ts` — **writes to Turso and deletes rows first** (see `docs/data-model.md` for exactly which tables) |
| `npm run db:reset` | `prisma migrate reset --force` + seed (local migrate, then destructive Turso seed) |
| `npm run db:migrate` | `prisma migrate dev` (local `dev.db` only) |
| `npm run db:push` | `prisma db push --env-file=.env` (local `dev.db` only — see below) |
| `npm run db:status` | `prisma migrate status` (local `dev.db` only) |
| `npm run db:seed-tables` | `tsx --env-file=.env prisma/seed-tables.ts` — **destructive:** deletes every `TeamTable` row in Turso and writes showcase grids |
| `npm run db:studio` | Prisma Studio browser (local `dev.db`) |

### Critical: two databases, two workflows

- **Runtime** talks to Turso via `@prisma/adapter-libsql` (`src/lib/prisma.ts`).
- **Prisma CLI** (`prisma.config.ts`) points at local `file:./dev.db` because the CLI
  **does not support `libsql://` URLs**. So `db:push`, `db:migrate`, `db:status` never touch Turso.

This is the single most common way to break a deploy: change the schema, run `db:push`, see it
succeed locally, and ship — leaving production with the old schema and a broken app.

When you change `prisma/schema.prisma`:

1. Locally: edit schema → `npm run db:migrate` (or `db:push`) to keep `dev.db` in sync.
2. For Turso: apply the equivalent SQL with `@libsql/client`, then verify the columns and indexes
   landed **before** deploying code that reads them. `dev/SCHEMA-UPDATE-GUIDE.md` (gitignored) has a
   worked example; the pattern is one `execute()` per statement, because `@libsql/client`'s
   `executeMultiple` and DDL path have proven unreliable from some networks.
3. **Order matters.** Apply the production migration *before* the code that needs it. Deploying
   code that selects a new column against an un-migrated database breaks the feature for everyone.
4. There is no `vercel.json`, so the Vercel build runs `npm run build` only and **never migrates**.
   Migration is always a manual, deliberate step.

> **Deprecated:** `turso-push.mjs` + root `migrate.sql`, and `update-turso-schema.mjs`. These replay
> a stale root `migrate.sql` that is out of sync with `prisma/schema.prisma` and contains no
> `RefreshToken` table. Do not use them for new migrations; write a purpose-built script instead.

## Project layout

```
prisma/                     Prisma schema, migrations, seed
src/
  app/api/                  All route handlers (see docs/api-reference.md)
  app/(dashboard, archive, admin)/…  Pages
  app/tools/                The Cabinet — /tools layout + pages
    tables/                 Team Tables list + editor
    drawers/                Drawers workspace page
  app/layout.tsx            Root layout (fonts, providers, sonner, SWR)
  app/globals.css           Tailwind v4 + design tokens
  app/manifest.ts           PWA manifest
  app/proxy.ts              ← actually src/proxy.ts (edge auth)
  components/
    ui/                     Button, Card, Badge, Modal, ProgressBar, CountUp, InView
    admin/                  CreateUserModal, EditUserModal (used by admin page)
    tools/                  ToolCard, ToolGrid; tools/tables/*; tools/drawers/*
    <feature>.tsx           Navbar, GoalCard, GoalForm, MonthSelector, NotificationPanel…
  contexts/                 AuthContext, ThemeContext
  hooks/                    usePolling, useRealtimeSync, useGoalMerge, useFileUpload, useModalA11y, useTableGrid
  lib/                      api-helpers, auth.server, notify, rateLimit, sections, permissions, drawers, workspaceFiles
    table/                  grid, date, pdf, table-permissions (all unit-tested)
  types/index.ts            Shared TS types + FALLBACK_SECTIONS
  generated/prisma/         Prisma client (generated — don't edit)
public/                     Static assets: /icons, /rina (Catarina stickers), /pfps, /media
                            (fonts come from next/font/google, self-hosted at build)
```

Note: `manifest.ts`, `robots.ts`, `sitemap.ts` live in `src/app/`; the edge proxy is `src/proxy.ts`.

## Core conventions

### Server helpers (`src/lib/api-helpers.ts`)
All route handlers follow the same pattern:

```ts
const auth = await requireUser();   // or requireAdmin()
if (!auth.ok) return auth.response;
```

- `requireUser()` → JWT payload (401 if invalid).
- `requireAdmin()` → verifies role **live from the DB** (never trust the JWT snapshot).
- `requireGoalAccess(userId, role, goalId)` → 404/403 with flag for goal-scoped routes.
- Input sanitizers: `asString(v, maxLen)`, `asPositiveInt`, `asNonNegativeInt`, `asBoolean`, `parseDate`.
- Shared error shape: `jsonError(message, status)` → `{ error: message }`.

### Auth (`src/lib/auth.server.ts` + `src/proxy.ts`)
- Tokens: HS256 JWT, 7-day expiry, HttpOnly cookie `catarina-token`.
- `JWT_SECRET` is **required at import time** — the server throws if it's missing.
- **Persistent one-time login**: alongside the session cookie, login mints a per-device refresh token
  (sha256-hashed in the `RefreshToken` table; raw value goes to the client in `localStorage["catarina-refresh"]`).
  On app load `AuthContext` first checks `/api/auth/me`; if the cookie is gone it calls `POST /api/auth/refresh`
  to silently re-issue it. Logout **revokes** the token server-side — otherwise the device would log back in.
  Logic lives in `src/lib/refreshToken.ts`; the shared user shape (login/me/refresh all identical) is built by
  `buildAuthUser` in `src/lib/auth-session.ts`.
- The login page redirects signed-in users: `src/app/page.tsx` checks the cookie server-side and
  `LoginForm` falls back to a client redirect after the silent refresh completes.
- `src/proxy.ts` is an Edge function (`matcher: ["/dashboard/:path*"]`) that verifies the JWT
  for page requests; it's the first line of defense, route handlers are the real checks.
- Client-side auth state: `AuthContext` (`login`, `register`, `logout`, `refreshUser`, `updateData`, `markWelcomeSeen`, `markUpdateSeen`).
- Password fields: use the shared `PasswordInput` component (`src/components/ui/PasswordInput.tsx`)
  — sign-in, registration, profile change-password, and admin modals all render through it.

### Realtime (see also `docs/api-reference.md` → `/api/changes`)
- `useRealtimeSync` polls `/api/changes?since=&monthId=&section=` on an adaptive schedule
  (active = 5s, idle >2min = ×3, hidden = ×6) using a ref-based snapshot + generation counter
  and exponential backoff (5→10→20→30s cap).
- `useGoalMerge` merges the delta (from `src/lib/mergeGoals.ts`) into local state; new goal IDs
  glow ~2 s, affected sections pulse ~3 s.
- `src/lib/toastSuppress.ts` lets the client suppress the incoming-change toast for its **own** mutations.

### Notifications (`src/lib/notify.ts`, `src/lib/constants.ts`)
- `notify`, `notifyMany`, `notifyAdmins`, `notifySection(section, opts, excludeUserId?)`.
- `NOTIFICATION_TYPES` lists all 17 types; the frontend `NotificationPanel` maps each type to an
  icon/color/image (`TYPE_ICON`, `TYPE_COLOR`, `TYPE_IMAGE`, `IMAGE_SIZES`).

### Permissions (`src/lib/permissions.ts`, `src/lib/constants.ts`)
- `MemberPermissions` has 6 boolean flags (`PERMISSION_KEYS`, with `PERMISSION_LABELS`).
- Stored as JSON (`serializePermissions` / `parsePermissions`, defaults conservative).
- `resolvePermissions(role, raw)` → admin always gets full set.
- Admin user create/update only intersect `PERMISSION_KEYS`, so **new keys must be added to
  `PERMISSION_KEYS`** or they're silently dropped.

### Sections (`src/lib/sections.ts`)
- `getSections()` lives in a 30 s in-memory cache; falls back to `FALLBACK_SECTIONS` if DB empty.
- After any section mutation, call `invalidateSectionCache()`.

### Uploads (`src/app/api/upload/route.ts`)
- File uploads become **base64 data URIs** (no filesystem writes → Vercel-safe).
- Magic-byte sniffing for jpg/png/gif/webp; 2 MB max; rate-limited 20/min/IP.
- The `register` route also accepts a `pfp` file field.
- **Drawer files** are different: chunked uploads into `WorkspaceUpload(Chunk)` → assembled into
  `WorkspaceFile` blobs in the DB (`src/lib/workspaceFiles.ts`); the drawer tree keeps `file://<id>`
  references. Uploads stay Vercel-safe through ≤3 MB raw-byte parts.

### Cabinet tools (`src/lib/tools.ts`, `src/components/tools/**`)
- The **tool registry** (`src/lib/tools.ts`) is the single source of truth for `/tools` cards + the
  navbar Cabinet label — add a `ToolMeta` entry to surface a new tool.
- **Tables**: grid engine + date helpers + PDF theme builder + permission helpers live in
  `src/lib/table/*` (pure, unit-tested); editor components in `src/components/tools/tables/`.
- **Drawers**: workspace tree logic in `src/lib/drawers.ts`, chunked-upload logic in
  `src/lib/workspaceFiles.ts`; components in `src/components/tools/drawers/`.
- Table saves debounce and **overwrite the whole `cells` document**; server rejects grids larger
  than 200×200 (`MAX_GRID_SIZE`).

## Styling & theming

- Tailwind **v4** with a custom theme in `src/app/globals.css` (`@theme` → CSS variables:
  `--bg`, `--accent`, `--text`, `--surface-*`, plus section colors).
- Dark is default (`html.dark`), light theme via `html.light`; `ThemeContext` persists
  `localStorage["catarina-theme"]`.
- `src/lib/pdf-palette.ts` mirrors the same tokens for PDF report export (dark/light).
- Section colors are per-section (`SectionConfig.color`), injected via inline styles / CSS vars.

## Testing

Node's built-in test runner with `tsx`:

```bash
npm test
```

Current suites (26 files, 194 tests). New security policy modules are unit-tested in isolation:
`rateLimit.test.ts` + `rateLimitPolicy.test.ts` (sliding window, sweep invariant, IP/account keying),
`loginPolicy.test.ts` (timing-equalized verification), `originGuard.test.ts` (CSRF origin
classification), `passwordPolicy.test.ts` (length/byte cap + breach blocklist),
`registrationPolicy.test.ts`, `publicSection.test.ts`, `refreshPolicy.test.ts` (rotation + family
ceiling), plus `mergeGoals`, `permissions`, `utils`, `workspaceFiles`, and the `table/` suites
(grid merge/split/insert/delete/resize, date detection, write-scoped flags).

> **Mock tables for local testing:** `dev/seed-tables.mjs` (gitignored, dev-only) seeds a few
> sample tables into Turso via direct `@libsql` inserts — run with `node --env-file=.env dev/seed-tables.mjs`.
> The main seed (`prisma/seed.ts` / `npm run db:seed`) does not create tables.
>
> ⚠️ The **tracked** `npm run db:seed-tables` (`prisma/seed-tables.ts`) is a *different, destructive*
> script: it deletes every `TeamTable` row in Turso and writes showcase grids. Don't reach for it
> when you only want a couple of mock tables.

## Deployment (Vercel)

1. Push to GitHub; import into Vercel as a new project.
2. Add the env vars:

   | Variable | Required | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_TEAM_NAME` | Yes | Team/org name shown in nav, footers, PDFs |
   | `NEXT_PUBLIC_SITE_URL` | Yes | Deployed URL |
   | `DATABASE_URL` | Yes | Turso `libsql://` connection string |
   | `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
   | `JWT_SECRET` | Yes | 32+ random chars; the app refuses to start without it and warns on weak values |
   | `TRUSTED_IP_HEADER` | Recommended | `x-forwarded-for` on Vercel. Without it every visitor shares one rate-limit bucket (safe, but blunt) |

3. Build command: `npx prisma generate && next build`
4. **Apply schema changes to Turso manually, before deploying the code that needs them.** There is
   no `vercel.json`, so the build never migrates. The Prisma CLI cannot reach Turso — see
   [two databases](#critical-two-databases-two-workflows).

> `db:reset` and `db:seed` will wipe the production DB if you accidentally run them against Turso —
> prefer one-off migration scripts for production schema changes.

## Security notes (why the code is shaped this way)

- **Admins are DB-reverified** on every admin route, so demoted admins lose access immediately.
- **Section checks are DB-based**, not JWT-snapshot based, so reassigned members can't keep old access.
- **Last-admin guard**: you cannot demote/delete the last `ADMIN`.
- **Data-loss guard**: you cannot delete a member who authored goals.
- **Registration is approval-gated and create-only**: a signup can never overwrite an existing
  account, and every conflict returns one uniform message. Stale requests are cleared by admins.
- **Rate limits are shared across Vercel instances (Turso) and fail CLOSED.** If Turso errors, the
  request falls through to a bounded in-memory counter rather than being allowed — a database
  hiccup must not become an open floodgate. Auth routes are double-keyed: a cheap per-IP layer plus
  a per-account layer hashed from the email, so rotating forged IPs cannot reset a brute-force budget.
- **The sweep margin is a tested invariant.** `SWEEP_MARGIN_MS` (20 min) must exceed the longest
  window (login's per-account 15 min) plus clock skew; `rateLimit.test.ts` fails if it doesn't.
  Widen a window and the test will tell you.
- **Per-IP keying reads only `TRUSTED_IP_HEADER`.** Never trust a client-chosen header, or the
  attacker picks their own bucket.
- **CSRF**: the session cookie is `SameSite=Lax` + `HttpOnly`, and independently the edge proxy
  requires a same-origin `Origin` on every mutating `/api` call, failing closed on `Origin: null`.
- **Refresh tokens rotate and are single-use**, with reuse revoking the whole family and a hard
  30-day ceiling. A stolen token is usable at most once.
- **Login is timing-equalized**: exactly one bcrypt comparison per attempt, whatever the input.
- **HttpOnly cookie + HS256 JWT** + required secret keeps tokens out of JS and unforgeable.
- **Password length is capped** (200 chars, 72 bytes) to avoid bcrypt DoS on absurd inputs, and new
  passwords must clear a common/breached-password blocklist. Existing weak passwords still work —
  the policy applies on write, so nobody is locked out.