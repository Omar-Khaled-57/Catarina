# <img src="../public/rina/wave.webp" width="80" align="center" /> Product

Catarina is a private, multi-section team planning and progress tracking application. Version 0.7.1 is the code described here; [`package.json`](../package.json) is the version source of truth.

## Problem and audience

Teams that work across several departments need one board where each department can track its own goals month by month, while an administrator keeps a global view. Catarina gives every department a **section** workspace, keeps planning cycles in **months**, and makes changes visible to the rest of the team without a manual refresh.

- **Team members** work inside the sections they are assigned to: goals, counters, checklists, comments, notifications, drawers, and tables.
- **Admins** see every section, approve signups, manage users and permissions, create/carry over/archive months, and configure sections.

## What it does today

| Capability | Where it lives |
| --- | --- |
| Login, approval-gated signup, persistent one-time login | `src/app/page.tsx`, `src/app/api/auth/**`, `src/lib/refreshToken.ts`, `src/contexts/AuthContext.tsx` |
| Role- and section-scoped access, six member permission flags | `src/lib/permissions.ts`, `src/lib/constants.ts`, `src/lib/api-helpers.ts` |
| Section boards with numbered goals, progress counters, deadlines, steps, comments, assignments | `src/app/dashboard/[section]/page.tsx`, `src/components/GoalCard.tsx`, `src/components/GoalForm.tsx`, `src/app/api/goals/**` |
| Monthly planning, carry-over, soft-archived months, multi-tab reports and PDF export | `src/app/dashboard/archive/**`, `src/app/api/months/**`, `src/lib/pdf-palette.ts` |
| Live change detection and delta sync | `src/hooks/useRealtimeSync.ts`, `src/hooks/usePolling.ts`, `src/lib/mergeGoals.ts`, `src/app/api/changes/route.ts` |
| In-app notification drawer with audio, pinning and read state | `src/components/NotificationPanel.tsx`, `src/lib/notify.ts`, `src/app/api/notifications/route.ts` |
| Self-service profiles (name, email, bio, avatar, password) | `src/components/ProfileModal.tsx`, `src/app/api/auth/profile/route.ts` |
| Admin panel: users, approvals, sections, roles, permissions | `src/app/dashboard/admin/page.tsx`, `src/components/admin/**`, `src/app/api/admin/**` |
| **The Cabinet** (`/tools`) — Drawers shared per section and Team Tables | `src/app/tools/**`, `src/lib/tools.ts`, `src/lib/drawers.ts`, `src/lib/workspaceFiles.ts`, `src/lib/table/**`, `src/components/tools/**` |
| Installable PWA (manifest + service worker) | `src/app/manifest.ts`, `public/sw.js` |
| Shared sliding-window rate limiting, CSRF origin guard, security headers | `src/lib/rateLimit.ts`, `src/lib/rateLimitPolicy.ts`, `src/lib/originGuard.ts`, `src/proxy.ts`, `next.config.ts` |

The full user-facing walkthrough is in [User Guide](./user-guide.md); route contracts are in [API Reference](./api-reference.md) and storage details in [Data Model](./data-model.md).

## Non-goals and known gaps

- **Not a public collaboration product.** Registration creates a pending `Approval`; an admin must approve it ([API Reference](./api-reference.md#auth)).
- **One database, two access paths.** The runtime uses Turso through `@libsql/client`; the Prisma CLI is pinned to local `file:./dev.db` in `prisma.config.ts`. Schema changes on Turso are manual SQL, applied before the code that needs them ([Developer Guide](./developer-guide.md#critical-two-databases-two-workflows)).
- **No external object storage or OAuth.** Avatars are base64 data URIs in the database; drawer files are chunked into database blobs. There is no filesystem write at runtime.
- **No billing, subscription, or payment code** is present in `src/`.
- **No CI workflow and no committed coverage report** were found in the repository. `npm test` prints counts, not coverage.
- **`dev/` is local-only.** It is gitignored and ESLint-ignored; the seed helpers in it are not shipped with the application.
- **CSP still requires `'unsafe-inline'`** for Next's inline hydration payload; byte sniffing on drawer downloads is the primary XSS control (`next.config.ts`, [CHANGELOG](../CHANGELOG.md)).
- The repository carries no license file in the audited tree; a standard MIT `LICENSE` has been added at the project root. The root `README.md` previously called the repository private — see [License](../README.md#license).

## Sources

[`package.json`](../package.json), [`prisma/schema.prisma`](../prisma/schema.prisma), [`prisma.config.ts`](../prisma.config.ts), [`src/proxy.ts`](../src/proxy.ts), [`next.config.ts`](../next.config.ts), [`README.md`](../README.md), [CHANGELOG.md](../CHANGELOG.md), [existing docs](./README.md).
