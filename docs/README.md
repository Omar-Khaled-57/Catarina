# <img src="../public/rina/logo.webp" width="80" align="center" /> Catarina — Documentation

Catarina is a private, multi-section team planning and progress tracking application.
This directory describes the application **as it exists today** (version 0.7.1).

## Start here

New to Catarina? Read [Product](product.md) for what the app does, [User Guide](user-guide.md) for the day-to-day workflow, then [Development](development.md) to run it locally. Operators should start with [Configuration](configuration.md) and [Deployment](deployment.md).

## Contents

| Document | Audience | Read this to... |
|---|---|---|
| [Product](product.md) | Everyone | Understand the problem, audience, feature inventory, and non-goals |
| [User Guide](user-guide.md) | Team members & admins | Use the app: log in, work in sections, create goals, write comments, run reports |
| [Architecture](architecture.md) | Developers | See the real stack, entry points, directory map, state/data flow, and storage boundaries |
| [Developer Guide](developer-guide.md) | Developers setting up or modifying the code | Set up locally, run scripts/tests, work with the Turso DB schema, deploy |
| [Development](development.md) | Developers new to the repo | Get prerequisites, exact npm scripts, conventions, and evidenced troubleshooting |
| [Configuration](configuration.md) | Operators | Inventory every env var, config file, flag, localStorage key, and user setting |
| [API Reference](api-reference.md) | Developers & AI agents | Understand every endpoint, its payloads, responses, and errors |
| [Data Model](data-model.md) | Developers & AI agents | Understand the Prisma schema, tables, relations, and invariants |
| [Testing](testing.md) | Developers | Run the Node test suite, see what is covered, and read the gaps |
| [Deployment](deployment.md) | Operators | Build, Vercel config, artifacts, and the manual Turso migration step |
| [Changelog](changelog.md) | Everyone | Find the release history and the in-app update feed |
| [AI Agent Guide](ai-agent-guide.md) | AI coding agents (AGENTS-style) | Get a file map, shell commands, conventions, and "read before editing" warnings |
| [Visual identity](visual-identity.md) | Designers & developers | Read the color system for dark/light themes and section accents |

## At a glance

- **Role-based**: `ADMIN` (global visibility) vs `MEMBER` (scoped to assigned sections).
- **Sections**: dynamic, admin-configurable departments (key, label, color, goal-number prefix).
- **Months**: monthly planning cycles; unfinished goals can carry over; past months archive.
- **Realtime**: clients sync ~every 5 s via delta polling (`/api/changes`) with exponential backoff and optimistic UI.
- **Notifications**: in-app drawer with pinned/read states, category icons, images, and audio.
- **Reports**: each archived month exports a multi-tab PDF report (dark/light).
- **The Cabinet (`/tools`)** <img src="../public/rina/excited.webp" width="36" align="center" />: a tools hub hosting **Drawers** (per-section shared cloud workspace, chunked uploads) and **Team Tables** (free-form grids: merge/split, date-mode today highlight, Rina stickers, themed PDF export).
- **Auth**: HttpOnly JWT cookie (`catarina-token`, HS256, 7 days) with a Vercel Edge `proxy.ts` check, plus a **persistent login** built on rotating refresh tokens: each token is single-use, a reused token revokes the whole family, and a family expires 30 days after the original sign-in. Signed-in users are redirected straight to `/dashboard`.
- **Password fields**: every password input (sign-in, registration, profile change-password, admin modals) uses the shared `PasswordInput` component with a show/hide toggle.
- **Stack**: Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + libSQL adapter → **Turso** · jose/bcryptjs · framer-motion · sonner.

## Canonical sources of truth

- Schema: `prisma/schema.prisma` · migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts` · env template: `.env.example`
- API route handlers: `src/app/api/**/route.ts`
- Shared libs/helpers: `src/lib/`
- Design tokens: `src/app/globals.css` (`@theme`) · report palette: `src/lib/pdf-palette.ts`
- License: [`LICENSE`](../LICENSE) (MIT)

> Version notes: `package.json` (version), `src/lib/changelog.json` (user-facing changelog). The
> changelog also drives the in-app update modal — existing entries must keep the same shape.
> **A new release must add its own `changelog.json` entry**, or the update modal silently falls back
> to a generic "Something new arrived!" message with no real content.

<div align="center">
  <img src="../public/rina/sleeping.webp" width="90" alt="Catarina Sleeping" /><br/>
  <sub>Docs maintained for v0.7.1 — Breach-Ready: The Nine Hardening Fixes.</sub>
</div>
