# <img src="../public/rina/thumb.webp" width="80" align="center" /> Deployment

Catarina is configured for **Vercel only**. The repository contains [`vercel.json`](../vercel.json) and no Netlify, Docker, or other deployment configuration.

## Build

| Script | Command | Result |
| --- | --- | --- |
| `npm run build` | `next build` | Production Next.js build into `.next/` (gitignored). |
| `npm install` | runs `prisma generate` via `postinstall` | Generates the Prisma client before the build. |
| Recommended Vercel build command | `npx prisma generate && next build` | Documented in [`README.md`](../README.md#step-6-deploy-to-vercel); `vercel.json` itself defines no `buildCommand`. |

`next build` type-checks the project. There is no separate `typecheck` script.

## Vercel configuration

[`vercel.json`](../vercel.json) contains exactly one setting:

```json
{ "regions": ["hnd1"] }
```

Functions are placed in `hnd1` (Tokyo), near the Turso database used by this instance. There are **no rewrites, headers, cron jobs, or migration hooks** in the file: security headers come from [`next.config.ts`](../next.config.ts), and schema changes are never applied during deployment.

Set the variables listed in [Configuration](./configuration.md) in the Vercel project — at minimum `NEXT_PUBLIC_TEAM_NAME`, `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `JWT_SECRET`; `TRUSTED_IP_HEADER=x-forwarded-for` is recommended so each visitor gets a distinct rate-limit bucket.

## Database rollout (the critical step)

The runtime uses Turso through the libSQL adapter (`src/lib/prisma.ts`); the Prisma CLI is pinned to `file:./dev.db` by [`prisma.config.ts`](../prisma.config.ts) and cannot reach `libsql://`. Therefore `npm run db:push`, `npm run db:migrate`, and `npm run db:status` affect only the local file.

1. Apply the equivalent SQL to Turso with a purpose-built `@libsql/client` script (one `execute()` per statement), then verify columns and indexes.
2. **Apply the migration before deploying code that reads the new columns.**
3. Deploy the code.

`npm run db:seed` and `npm run db:seed-tables` write to Turso and delete existing rows first — they are not deployment steps. `npm run db:setup` pushes the local file and seeds Turso but does not create the Turso schema. See [Developer Guide](./developer-guide.md#critical-two-databases-two-workflows) and [Data Model](./data-model.md#schema-generation--migrations).

## Artifacts and local verification

- `next build` output: `.next/` (gitignored).
- Generated Prisma client: `src/generated/prisma/` (gitignored).
- Local SQLite file: root `dev.db` (gitignored).
- Local `.vercel/` metadata is gitignored.
- No deployment script is tracked in `package.json`; Vercel runs the configured/default build and serves the Next.js output.

Before deploying, the documented checks are `npm run lint`, `npm run build`, and `npm test` (see [Testing](./testing.md)). No CI workflow is committed, so these are manual.

## Not configured

- No Netlify or other second platform config; no `Dockerfile`, `docker-compose`, or infrastructure manifests.
- No automatic database migration or seed step in the build.
- No CI/CD pipeline, deployment scripts, or release automation in the repo.
- `turso-push.mjs`, `update-turso-schema.mjs`, and root `migrate.sql` are documented as deprecated: they replay a stale schema and omit `RefreshToken`.

## Sources

[`package.json`](../package.json), [`vercel.json`](../vercel.json), [`next.config.ts`](../next.config.ts), [`prisma.config.ts`](../prisma.config.ts), [`.gitignore`](../.gitignore), [`README.md`](../README.md#step-6-deploy-to-vercel), [Developer Guide](./developer-guide.md#deployment-vercel), [CHANGELOG.md](../CHANGELOG.md).
