# <img src="../public/rina/edit.webp" width="80" align="center" /> Configuration

All deployment configuration is read from environment variables, the files listed below, and per-user database/localStorage settings. The env template is [`.env.example`](../.env.example); copy it to `.env` for local work (`.env*` is gitignored except the template).

## Environment variables

| Variable | Required | Default in code | Read by | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_TEAM_NAME` | yes in practice | `"Your Team"` | `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/page.tsx`, `src/components/LoginForm.tsx`, `src/components/Footer.tsx`, `src/app/dashboard/archive/[monthId]/ArchivedMonthView.tsx` | Team name in nav, footers, metadata, PWA manifest, PDFs. The fallback means a missing value still renders, but with generic branding. |
| `NEXT_PUBLIC_SITE_URL` | yes in practice | `"http://localhost:3000"` | `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` | Canonical base URL for SEO, sitemap, robots and share metadata. Set it to the deployed origin. |
| `DATABASE_URL` | yes | none — `src/lib/prisma.ts` throws if no URL is set | `src/lib/prisma.ts`, `src/lib/rateLimit.ts`, `src/lib/workspaceFiles.ts`, `prisma/seed.ts`, `prisma/seed-tables.ts`, deprecated root scripts | Turso `libsql://…` connection string used at runtime and by seed scripts. |
| `TURSO_AUTH_TOKEN` | yes with a remote Turso URL | none | same as `DATABASE_URL` | Database auth token. Must not be committed. |
| `JWT_SECRET` | yes | none — `src/lib/auth.server.ts` throws at import when missing | `src/lib/auth.server.ts`, `src/proxy.ts`, login/register routes (HMAC account keys) | Signs the HS256 session cookie and keys per-account rate-limit hashes. `.env.example` asks for 32+ random characters; short/guessable values produce a boot warning. |
| `DEV_DATABASE_URL` | no | unset | `src/lib/prisma.ts`, `src/lib/rateLimit.ts` | When `NODE_ENV !== "production"`, overrides the runtime database (e.g. `file:./dev.db`). Not synced with Turso and not used by the Prisma CLI, which is pinned separately in `prisma.config.ts`. |
| `TRUSTED_IP_HEADER` | recommended | unset | `src/lib/rateLimit.ts` via `src/lib/rateLimitPolicy.ts` | The single request header the proxy overwrites with the true client IP (e.g. `x-forwarded-for` on Vercel). Unset means one shared IP bucket: safe but blunt. |
| `NODE_ENV` | set by the platform | platform-dependent | `next.config.ts`, auth cookie `secure` flag, Prisma/rate-limit local override | Production enables HSTS, drops dev-only `unsafe-eval`, marks the cookie `Secure`, and disables `DEV_DATABASE_URL`. |

No other `process.env.*` reads were found in the application source or scripts.

## Config files

| File | What it controls |
| --- | --- |
| [`prisma.config.ts`](../prisma.config.ts) | Prisma CLI schema path (`prisma/schema.prisma`), migrations path, and datasource URL fixed at `file:./dev.db`. The CLI cannot reach `libsql://`. |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | SQLite schema for all models; `generator client` uses the `driverAdapters` preview feature. |
| [`next.config.ts`](../next.config.ts) | Security headers and CSP (production vs development), HSTS in production, immutable cache headers for `/icons`, `/rina`, `/pfps`, `/fonts`. |
| [`vercel.json`](../vercel.json) | Function region `hnd1` (Tokyo) only — no build command, rewrites, or migration hook. |
| [`tsconfig.json`](../tsconfig.json) | Strict TypeScript, `@/*` → `./src/*`, `noEmit`, excludes `prisma/seed.ts`. |
| [`postcss.config.mjs`](../postcss.config.mjs) | Tailwind v4 through `@tailwindcss/postcss`. |
| [`eslint.config.mjs`](../eslint.config.mjs) | ESLint config for the app (the `dev/**` directory is ignored). |
| [`src/app/manifest.ts`](../src/app/manifest.ts) | PWA manifest derived from the two `NEXT_PUBLIC_*` variables. |
| [`src/lib/changelog.json`](../src/lib/changelog.json) | In-app update modal content; must include an entry for the current version. |
| [`src/lib/constants.ts`](../src/lib/constants.ts) | Cookie name `catarina-token`, roles, 17 notification types, six `PERMISSION_KEYS`. |

Deprecated and **not** part of the supported configuration path: `turso-push.mjs`, `update-turso-schema.mjs`, and root `migrate.sql` replay a stale schema; see [Developer Guide](./developer-guide.md#critical-two-databases-two-workflows).

## Browser and user settings

| Key / setting | Stored in | Meaning |
| --- | --- | --- |
| `catarina-token` | HttpOnly cookie | 7-day HS256 JWT session (`SameSite=Lax`, `Secure` in production). |
| `catarina-refresh` | `localStorage` | Per-device rotating refresh token; the raw value never lives in the DB. |
| `catarina-theme` | `localStorage` | `"dark"` or `"light"` theme (`src/contexts/ThemeContext.tsx`). |
| `catarina-custom-colors` | `localStorage` | Up to 10 custom colors in `src/components/ColorPicker.tsx`. |
| Profile fields | `User` row | Name, email, bio, avatar, password, `primarySection` (admins), `welcomeSeen`, `lastSeenVersion`, `sessionVersion`. |
| Member permissions | `User.permissions` JSON | Six booleans from `PERMISSION_KEYS`; admins always resolve to the full set. |
| Section config | `SectionConfig` rows | Uppercase key, label, goal prefix, hex color, sort order, active flag; mutated in the Admin Panel. |
| Table / drawer layout | `TeamTable.cells`/`stickers`, `DrawerSection.tree` | Grid, sticker and workspace-tree state are persisted server-side, not in localStorage. |

## Security notes

- Never commit `.env`, `.env.local`, or real values for `DATABASE_URL`, `TURSO_AUTH_TOKEN`, or `JWT_SECRET`. Only [`.env.example`](../.env.example) is tracked; `.gitignore` excludes the rest.
- `.env` exists in this working directory but is gitignored; its contents are intentionally not documented here.
- `JWT_SECRET` is also used as an HMAC key so plaintext emails are not stored in `rate_limit_events`.
- Per-IP rate-limit keys read only `TRUSTED_IP_HEADER`; do not trust an arbitrary client-chosen header.
- The service worker keeps `/api` requests network-only and caches static assets; see `public/sw.js`.

## Known gaps

- There is no `.env.production` template and no committed secret-scanning or CI configuration.
- `DEV_DATABASE_URL` is opt-in and entirely separate from Turso: an empty local database will not show teams, tables, or drawer files until it is pushed and seeded independently.

## Sources

[`.env.example`](../.env.example), [`.gitignore`](../.gitignore), [`package.json`](../package.json), [`prisma.config.ts`](../prisma.config.ts), [`next.config.ts`](../next.config.ts), [`vercel.json`](../vercel.json), [`src/lib/prisma.ts`](../src/lib/prisma.ts), [`src/lib/rateLimit.ts`](../src/lib/rateLimit.ts), [`src/lib/constants.ts`](../src/lib/constants.ts), [`src/lib/auth.server.ts`](../src/lib/auth.server.ts), [`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx), [`src/contexts/ThemeContext.tsx`](../src/contexts/ThemeContext.tsx), [`src/components/ColorPicker.tsx`](../src/components/ColorPicker.tsx).
