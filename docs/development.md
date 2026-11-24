# <img src="../public/rina/note.webp" width="80" align="center" /> Development

Start here for local setup. [Developer Guide](./developer-guide.md) is the deeper companion (two-database workflow, security rationale, full project layout); [AI Agent Guide](./ai-agent-guide.md) is the fast map for changes.

## Prerequisites

- **Node.js** — the root [`README.md`](../README.md#prerequisites) states v20.0.0 or higher. `package.json` has no `engines` field.
- **npm** — used by every documented command.
- **Turso account** — the runtime database is `libsql://`; an optional Vercel account is needed only for deployment.
- No separate Redis service: rate limiting uses the same Turso database.

## Install and run

```bash
npm install          # postinstall runs `prisma generate`
cp .env.example .env # fill in DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET
npm run db:setup     # pushes local dev.db and seeds Turso (destructive seed)
npm run dev          # http://localhost:3000
```

Seeded admin: `admin@team.com` / `admin123` — change it after first login. For a local session that never contacts Turso, set `DEV_DATABASE_URL="file:./dev.db"` and run `npm run db:push`; this database is independent of Turso. See [Configuration](./configuration.md).

## Commands (from `package.json`)

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `next dev` | Development server on port 3000 |
| `npm run build` | `next build` | Production build (also type-checks) |
| `npm run start` | `next start` | Serve the production build |
| `npm run lint` | `eslint` | ESLint |
| `npm test` | `node --import tsx --test "src/**/*.test.ts"` | Unit tests |
| `npm run db:migrate` | `npx prisma migrate dev` | Local `dev.db` migrations only |
| `npm run db:push` | `npx prisma db push --env-file=.env` | Push schema to local `dev.db` only |
| `npm run db:status` | `npx prisma migrate status` | Local migration status |
| `npm run db:seed` | `npx tsx --env-file=.env prisma/seed.ts` | Destructive seed of Turso |
| `npm run db:seed-tables` | `npx tsx --env-file=.env prisma/seed-tables.ts` | Destructive showcase tables in Turso |
| `npm run db:setup` | `npx prisma db push --env-file=.env && npm run db:seed` | Local push + Turso seed |
| `npm run db:reset` | `npx prisma migrate reset --force && npm run db:seed` | Local reset + Turso seed |
| `npm run db:studio` | `npx prisma studio` | Browse local `dev.db` |
| `postinstall` | `prisma generate` | Generates the client on install |

`npm run db:seed` deletes the 11 tables listed in [Data Model](./data-model.md#seed-script) before re-seeding; `npm run db:seed-tables` deletes every `TeamTable` row. Neither is safe against data you want to keep.

## Repository structure

```
prisma/       schema.prisma, migrations/, seed.ts, seed-tables.ts
src/app/      App Router pages, /api route handlers, manifest/robots/sitemap
src/components/ UI, admin modals, tools/ (tables and drawers)
src/contexts/ AuthContext, ThemeContext
src/hooks/    polling, realtime sync, goal merge, file upload, table grid
src/lib/      auth, policies, rate limiter, sections, notify, table/, tests
src/types/    shared types and FALLBACK_SECTIONS
public/       icons, rina stickers, pfps, media, sw.js
dev/          gitignored local notes and demo helpers (not shipped)
```

The full annotated tree is in [Developer Guide](./developer-guide.md#project-layout).

## Conventions

- Follow `requireUser()` / `requireAdmin()` / `jsonError()` from `src/lib/api-helpers.ts`; sanitize inputs and re-read roles from the database — never trust the JWT's role or section claims.
- New member permission flags must be added to `PERMISSION_KEYS` in `src/lib/constants.ts` or admin create/update silently drops them.
- New notification types need both `NOTIFICATION_TYPES` and the icon/color/image maps in `NotificationPanel.tsx`.
- No runtime filesystem writes: avatars are data URIs and drawer files are database blobs.
- Use `@/*` imports (`tsconfig.json`), Tailwind v4 tokens in `src/app/globals.css`, and the shared `PasswordInput` for password fields.
- Never edit `src/generated/prisma/`; regenerate with `prisma generate`.
- A version bump touches `package.json`, `package-lock.json`, `src/lib/changelog.json`, `CHANGELOG.md`, `README.md`, and the footer chip (`src/components/Footer.tsx`).
- Keep documentation in sync with route handlers and schema; see [AI Agent Guide](./ai-agent-guide.md#0-golden-rules).

## How to add a feature

1. Change the schema in `prisma/schema.prisma` if needed; run `npm run db:migrate` locally, then write a separate SQL script for Turso and apply it **before** deploying code that reads new columns ([Developer Guide](./developer-guide.md#critical-two-databases-two-workflows)).
2. Add the route handler under `src/app/api/<group>/` and document it in [API Reference](./api-reference.md).
3. Add UI components under `src/components/` and wire the page under `src/app/`.
4. Add pure logic under `src/lib/` with a colocated `*.test.ts` file, then run `npm test`, `npm run lint`, and `npm run build`.
5. Update the relevant docs and [CHANGELOG.md](../CHANGELOG.md) / `src/lib/changelog.json` for releases.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Schema change works locally but not in production | `prisma.config.ts` pins the CLI to `file:./dev.db`; apply SQL to Turso manually (see above). |
| Server throws at startup about `JWT_SECRET` | `src/lib/auth.server.ts` requires it at import time; set it in `.env`/hosting. Weak values are warned about, not rejected. |
| Auth, month, notification or drawer reads return `503` with `Retry-After: 2` | Transient Turso failure; retry — do not treat it as a logout. Drawer writes are not auto-replayed. |
| Section list looks stale after an admin edit | Call `invalidateSectionCache()` after section mutations; `getSections()` caches for 30 s. |
| A new permission flag never reaches users | Add it to `PERMISSION_KEYS` in `src/lib/constants.ts`. |
| "Schema didn't update" after running a root script | `turso-push.mjs`, `update-turso-schema.mjs`, and `migrate.sql` are deprecated and stale; write a purpose-built `@libsql/client` script. |
| Rate limits all share one bucket | `TRUSTED_IP_HEADER` is unset; set it to the header your proxy overwrites (e.g. `x-forwarded-for`). |

## Sources

[`package.json`](../package.json), [`README.md`](../README.md#prerequisites), [`prisma.config.ts`](../prisma.config.ts), [`src/lib/api-helpers.ts`](../src/lib/api-helpers.ts), [`src/lib/constants.ts`](../src/lib/constants.ts), [`src/lib/sections.ts`](../src/lib/sections.ts), [Developer Guide](./developer-guide.md), [AI Agent Guide](./ai-agent-guide.md), [Testing](./testing.md).
