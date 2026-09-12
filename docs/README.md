# Catarina — Documentation

Catarina is a private, multi-section team planning and progress tracking application.
This directory describes the application **as it exists today** (version 0.4.5).

## Contents

| Document | Audience | Read this to... |
|---|---|---|
| [User Guide](user-guide.md) | Team members & admins | Use the app: log in, work in sections, create goals, write comments, run reports |
| [API Reference](api-reference.md) | Developers & AI agents | Understand every endpoint, its payloads, responses, and errors |
| [Data Model](data-model.md) | Developers & AI agents | Understand the Prisma schema, tables, relations, and invariants |
| [Developer Guide](developer-guide.md) | Developers setting up or modifying the code | Set up locally, run scripts/tests, work with the Turso DB schema, deploy |
| [AI Agent Guide](ai-agent-guide.md) | AI coding agents (AGENTS-style) | Get a file map, shell commands, conventions, and "read before editing" warnings |

## At a glance

- **Role-based**: `ADMIN` (global visibility) vs `MEMBER` (scoped to assigned sections).
- **Sections**: dynamic, admin-configurable departments (key, label, color, goal-number prefix).
- **Months**: monthly planning cycles; unfinished goals can carry over; past months archive.
- **Realtime**: clients sync ~every 5 s via delta polling (`/api/changes`) with exponential backoff and optimistic UI.
- **Notifications**: in-app drawer with pinned/read states, category icons, images, and audio.
- **Reports**: each archived month exports a multi-tab PDF report (dark/light).
- **Auth**: HttpOnly JWT cookie (`catarina-token`, HS256, 7 days) with a Vercel Edge `proxy.ts` check.
- **Stack**: Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + libSQL adapter → **Turso** · jose/bcryptjs · framer-motion · sonner.

## Canonical sources of truth

- Schema: `prisma/schema.prisma` · migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts` · env template: `.env.example`
- API route handlers: `src/app/api/**/route.ts`
- Shared libs/helpers: `src/lib/`
- Design tokens: `src/app/globals.css` (`@theme`) · report palette: `src/lib/pdf-palette.ts`

> Version notes: `package.json` (version), `src/lib/changelog.json` (user-facing changelog). The
> changelog also drives the in-app update modal — existing entries must keep the same shape.