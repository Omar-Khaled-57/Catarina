# <img src="../public/rina/think.webp" width="80" align="center" /> Architecture

Catarina is a single **Next.js 16 App Router** application written in TypeScript. React 19 renders both pages and route handlers; there is no separate API service. The runtime talks to **Turso (libSQL)** through the Prisma 7 driver adapter, while the Prisma CLI talks to a local SQLite file.

## Stack

| Layer | Choice | Evidence |
| --- | --- | --- |
| Framework / language | Next.js `16.3.6`, React `19.2.4`, TypeScript 5 | [`package.json`](../package.json) |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` | [`postcss.config.mjs`](../postcss.config.mjs), `src/app/globals.css` |
| Database / ORM | Turso libSQL, `@libsql/client`, `@prisma/adapter-libsql`, Prisma 7 | [`src/lib/prisma.ts`](../src/lib/prisma.ts), [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Auth | `jose` HS256 JWT in an HttpOnly cookie, `bcryptjs` hashes, rotating refresh tokens | `src/lib/auth.server.ts`, `src/lib/refreshToken.ts`, `src/lib/constants.ts` |
| UI helpers | framer-motion, sonner, lucide-react, clsx | [`package.json`](../package.json) |
| Tests | Node built-in test runner with `tsx` | [`package.json`](../package.json) |
| Host | Vercel Functions pinned to `hnd1`; no other deploy config is committed | [`vercel.json`](../vercel.json) |

## Entry points and process model

- `src/app/layout.tsx` — root layout: fonts, `ThemeContext`, `AuthContext`, toaster, service worker registration.
- `src/app/page.tsx` — login screen; redirects signed-in users server-side.
- `src/app/dashboard/**` — dashboard, section boards, archive/report pages, admin panel.
- `src/app/tools/**` — the Cabinet: tool grid, Team Tables, Drawers.
- `src/app/api/**/route.ts` — every API endpoint; see [API Reference](./api-reference.md).
- `src/proxy.ts` — Next.js 16 edge **proxy** (not "middleware") matching `/dashboard/:path*`, `/tools/:path*`, `/api/:path*`; it verifies the JWT for page routes and applies the same-origin guard to mutating API routes.
- `public/sw.js` — client-side PWA service worker; API requests stay network-only, static assets are cache-first.

There is one application process in local development (`next dev`) and one Next.js serverless function deployment on Vercel. No queue worker, cron job, or separate API container is configured in the repo.

## Directory map

```
prisma/                  schema.prisma, migrations/, seed.ts, seed-tables.ts
src/
  app/                   App Router pages, route handlers, manifest/robots/sitemap
  components/            UI primitives, feature components, admin/, tools/
  contexts/              AuthContext, ThemeContext
  hooks/                 usePolling, useRealtimeSync, useGoalMerge, useTableGrid, …
  lib/                   api helpers, auth/policy modules, rate limiter, sections,
                         notifications, PDF palette, drawers, table engine, tests
  types/index.ts         shared types + FALLBACK_SECTIONS
  generated/prisma/      generated client (gitignored — do not edit)
public/                  icons, rina stickers, pfps, media, sw.js
```

The richer, file-by-file map is in [Developer Guide](./developer-guide.md#project-layout) and [AI Agent Guide](./ai-agent-guide.md#1-repo-layout-fast-map).

## Data and state flow

1. **Auth flow.** `POST /api/auth/login` verifies a bcrypt hash, sets a 7-day HttpOnly `catarina-token` cookie, and returns a per-device refresh token. `AuthContext` keeps the user in client state and uses `POST /api/auth/refresh` to silently re-issue an expired cookie. Every protected route re-checks the user (and, for admin routes, the role) from the database via `src/lib/api-helpers.ts`.
2. **Read flow.** Server components and route handlers use the singleton Prisma client in `src/lib/prisma.ts`. Section configuration reads are cached for 30 seconds by `src/lib/sections.ts` and invalidated on section mutations.
3. **Write flow.** API route handlers validate and sanitize input, check role/section permissions, then write through Prisma. Uploads never touch the filesystem: profile photos are base64 data URIs in database columns; drawer files are assembled from ≤3 MB chunks into `WorkspaceFile` blobs (`src/lib/workspaceFiles.ts`).
4. **Realtime flow.** `useRealtimeSync` polls `GET /api/changes` for `MAX(updatedAt)` timestamps and a notification count, fetches deltas with `?since=`, and merges them with `src/lib/mergeGoals.ts`. The active interval is 5 seconds, backed off when idle/hidden and on errors; see [API Reference](./api-reference.md#realtime-sync).
5. **Table flow.** Grid operations are pure functions in `src/lib/table/grid.ts`; the whole `cells` JSON document is written on save with compare-and-swap on `updatedAt`. Drawers use a per-section `version` counter for whole-tree optimistic locking.

## Storage and integration boundaries

- **Turso** is the single runtime store: users, goals, sections, months, notifications, approvals, rate-limit events, refresh tokens, tables, drawer trees, and file blobs. The table inventory is in [Data Model](./data-model.md).
- **Local `dev.db`** is used only by the Prisma CLI and, optionally, by non-production runtime via `DEV_DATABASE_URL`. It is a separate database with its own schema and data; see [Configuration](./configuration.md).
- **Rate limiting** uses `rate_limit_events` in the active database, with a bounded in-memory fallback that fails closed if the database is unavailable (`src/lib/rateLimit.ts`).
- **No external storage, OAuth, email, or analytics provider** is wired into `src/`; the repository has no such service configuration.

## Known gaps

- The Prisma CLI cannot reach `libsql://`; applying production schema changes is a manual SQL step outside the build ([deployment](./deployment.md)).
- `turso-push.mjs`, `update-turso-schema.mjs`, and the root `migrate.sql` are documented as deprecated and out of sync with `prisma/schema.prisma`.
- No CI workflow or committed coverage report is present.

## Sources

[`package.json`](../package.json), [`next.config.ts`](../next.config.ts), [`prisma.config.ts`](../prisma.config.ts), [`prisma/schema.prisma`](../prisma/schema.prisma), [`src/proxy.ts`](../src/proxy.ts), [`src/lib/prisma.ts`](../src/lib/prisma.ts), [`vercel.json`](../vercel.json), [Developer Guide](./developer-guide.md), [Data Model](./data-model.md).
