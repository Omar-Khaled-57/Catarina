# <img src="../public/rina/think.webp" width="90" align="center" /> Data Model

The database is **SQLite** (via Turso/libSQL in production, `dev.db` locally). The schema is defined in `prisma/schema.prisma` and accessed through a singleton Prisma client (`src/lib/prisma.ts`) configured with the `@prisma/adapter-libsql` driver adapter.

All IDs use `cuid()` unless otherwise noted.

---

## Entity overview

```
User ──1:N──▶ UserSection
User ──1:N──▶ Goal
User ──1:N──▶ GoalAssignment
User ──1:N──▶ Comment
User ──1:N──▶ Notification
Goal ──1:N──▶ Comment
Goal ──1:N──▶ GoalAssignment
Goal ──1:N──▶ Step
Goal ──N:1──▶ Month
Goal ──N:1──▶ User (author)
Month ──1:N──▶ Archive
SectionConfig (standalone)
Approval (standalone)
RateLimitEvent (standalone, append-only, sweeped)
TeamTable (standalone per section; soft-deletable)
DrawerSection (standalone; one JSON tree per section)
WorkspaceUpload / WorkspaceUploadChunk / WorkspaceFile (chunked file storage)
AppConfig (standalone key/value — currently unused)
```

---

## Models

### `User`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | Primary key |
| `name` | String | — | Display name |
| `email` | String | — | Unique login email |
| `password` | String | — | bcrypt hash (12 rounds) |
| `role` | String | `"MEMBER"` | `"ADMIN"` or `"MEMBER"` |
| `pfp` | String? | null | Base64 data URI or `/pfps/...` path |
| `bio` | String? | null | Short bio line |
| `primarySection` | String? | null | Admin only: highlighted dashboard section |
| `permissions` | String | `"{}"` | JSON `MemberPermissions` (member only; admins always get full set) |
| `welcomeSeen` | Boolean | false | Whether the onboarding modal has been shown |
| `lastSeenVersion` | String | `"0.3.2"` | For in-app update notifications |
| `createdAt` / `updatedAt` | DateTime | now / @updatedAt | — |

- Unique on `email`. Indexed on `role`.
- Relations: `goals` (author), `comments`, `userSections`, `goalAssignments`, `notifications`.

### `UserSection`
| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `userId` | String | FK → `User.id` (cascade delete) |
| `section` | String | Section key, e.g. `"MARKETING"` |
| `createdAt` | DateTime | — |

- Unique constraint: `[userId, section]`. Indexed on `section`.

### `SectionConfig`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | Primary key |
| `key` | String | — | Unique uppercase key: `"MARKETING"` |
| `label` | String | — | Display name: `"Marketing"` |
| `prefix` | String | — | Goal number prefix: `"MRK-"` |
| `color` | String | — | Hex color: `"#FF4D6A"` |
| `sortOrder` | Int | 0 | Display ordering |
| `isActive` | Boolean | true | Soft-deleted sections set to false |
| `createdAt` / `updatedAt` | DateTime | — | `updatedAt` drives realtime `sectionsVersion` in `/api/changes` |

- Unique on `key`. Indexed on `isActive`, `sortOrder`.
- Loaded by `src/lib/sections.ts` → `getSections()` with a **30-second in-memory cache**. Falls back to `FALLBACK_SECTIONS` (`src/types/index.ts:93`) if the DB is empty or unreachable. Cache invalidated by section create/update/delete via `invalidateSectionCache()`.

### `Month`
| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Display label, e.g. `"06/26"` |
| `year` | Int | — |
| `month` | Int | 1–12 |
| `isArchived` | Boolean | Default false |
| `createdAt` / `updatedAt` | DateTime | — |

- Unique constraint: `[year, month]`. `409` on duplicate when creating via `POST /api/months/create`.
- Deleting a month cascades to its goals.

### `Goal`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | — |
| `name` | String | — | ≤200 chars enforced by API |
| `description` | String | — | ≤5000 chars |
| `goalNumber` | Int | 0 | Auto-incrementing per section |
| `current` | Int | 0 | Current progress value |
| `target` | Int | 1 | Target progress value |
| `done` | Boolean | false | Completion flag |
| `deadline` | DateTime | — | ISO date string |
| `completedAt` | DateTime? | null | Set when `done` toggled to true |
| `carriedOver` | Boolean | false | True if copied from a previous month |
| `section` | String | — | Section key (string, not a FK) |
| `deadlineSetByAdmin` | Boolean | false | Non-admins can't change deadlines once set by an admin |
| `monthId` | String | — | FK → `Month.id` (cascade) |
| `authorId` | String | — | FK → `User.id` (cascade) |
| `createdAt` / `updatedAt` | DateTime | now / @updatedAt | `updatedAt` drives `/api/changes` |

- Indexed on `section`, `monthId`, `done`, `deadline`.
- `goalNumber` is the next number for that section (max +1). Goal display name = `{PREFIX}{goalNumber}`.

### `Step`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | — |
| `text` | String | — | Step description (≤500 chars) |
| `done` | Boolean | false | — |
| `order` | Int | 0 | Sort order within the goal |
| `goalId` | String | — | FK → `Goal.id` (cascade) |

### `Comment`
| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | — |
| `text` | String | ≤2000 chars |
| `goalId` | String | FK → `Goal.id` (cascade) |
| `authorId` | String | FK → `User.id` (cascade) |
| `createdAt` / `updatedAt` | DateTime | — |

### `GoalAssignment`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | — |
| `canCheck` | Boolean | true | Can toggle done/unchecked |
| `canEdit` | Boolean | false | Can edit goal details |
| `goalId` | String | — | FK → `Goal.id` (cascade) |
| `userId` | String | — | FK → `User.id` (cascade) |

- Unique constraint: `[goalId, userId]`. Indexed on `userId`.

### `Notification`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | — |
| `userId` | String | — | FK → `User.id` (cascade) |
| `type` | String | — | One of 17 `NOTIFICATION_TYPES` (see `src/lib/constants.ts`) |
| `title` | String | — | Short heading |
| `message` | String | — | Body text |
| `read` | Boolean | false | — |
| `pinned` | Boolean | false | Pinned always sorts first |
| `refId` | String? | null | ID of related entity |
| `refType` | String? | null | `"goal"`, `"user"`, `"month"`, `"approval"`, `"audio"`, `"update"` |
| `createdAt` | DateTime | — | — |

- Indexed on `[userId, read]`, `[userId, pinned]`, `[createdAt]`.
- Created by helpers in `src/lib/notify.ts` (`notify`, `notifyMany`, `notifyAdmins`, `notifySection` with optional `excludeUserId`).

### `Approval`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | — |
| `name` | String | — | — |
| `email` | String | — | Unique |
| `password` | String | — | bcrypt hash (stored until approved) |
| `section` | String | — | Requested section key |
| `pfp` | String? | null | Optional profile photo data URI |
| `status` | String | `"PENDING"` | `"PENDING"`, `"APPROVED"`, or `"REJECTED"` |
| `createdAt` / `updatedAt` | DateTime | — | — |

- `POST /api/auth/register` upserts by email: if a previous REJECTED approval exists for the same email, it's updated back to PENDING (allows re-registration).
- On approve: a `User` is created (role `MEMBER`), a `UserSection` is added, and the user is assigned a default section avatar via `getDefaultPfp()` (`src/lib/utils.ts:119`) if they didn't upload their own.

### `RateLimitEvent`
| Column | Type | Notes |
|---|---|---|
| `id` | String (randomUUID) | Primary key |
| `key` | String | Rate-limit key: `"login:1.2.3.4"`, `"register:1.2.3.4"`, `"upload:1.2.3.4"`, `"profile:password:u_xxx"` |
| `ts` | BigInt | Epoch milliseconds |

- Indexed on `[key, ts]`, `[ts]`. Append-only. Rows are **swept** by `src/lib/rateLimit.ts`:
  - Per-key: events older than `now - windowMs` are deleted on every check.
  - Global sweep: events older than `now - 10 min` (the `SWEEP_MARGIN_MS`, chosen to exceed the longest window, which is 5 min for register) are deleted at most once per minute per instance.

### `TeamTable`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | auto | Primary key |
| `section` | String | — | `SectionConfig.key` (not a FK — like goals) |
| `name` | String | — | Table title (≤200 chars enforced by API) |
| `color` | String | `"#00E8A2"` | App accent teal; `SECTION_COLORS` are picker options |
| `cells` | Json | — | `GridState` — `{ cols: number, rows: GridCell[][] }`; `GridCell = { v, rs, cs } \| null` (merged spans hold content, covered cells are `null`) |
| `stickers` | Json | `"[]"` | `StickerData[]` — `{ id, sprite, x, y, w?, locked?, mirrored?, state? }` |
| `isDateBased` | Boolean | false | Date-mode auto-detect today's column/row |
| `createdById` | String | — | Author user id (plain scalar) |
| `createdAt` / `updatedAt` | DateTime | now / @updatedAt | — |
| `deletedAt` | DateTime? | null | Soft delete; hard-purge later |

- Indexed on `section`, `createdById`, `deletedAt`. Whole document is rewritten on each grid mutation (single-document model keeps merge/split/insert/delete atomic).
- Grid size cap: rows and cols ≤ **200** (`MAX_GRID_SIZE`), cell sizes clamped 48–640 px.

### `DrawerSection`
| Column | Type | Default | Notes |
|---|---|---|---|
| `key` | String | — | Primary key = section key |
| `tree` | String | — | JSON `DemoProject[]` — the entire drawer tree for that section |
| `version` | Int | 0 | Optimistic-lock counter for whole-tree writes (stale writers get 409) |
| `createdAt` / `updatedAt` | DateTime | now / @updatedAt | — |

- Each section has exactly one row holding the whole shared tree (cloud-backed, no OAuth).

### `WorkspaceUpload`
| Column | Type | Notes |
|---|---|---|
| `id` | String (randomUUID) | `uploadId` |
| `sectionKey` | String | Owning section |
| `projectId` | String | — |
| `envelopeId` | String? | Null for loose files |
| `name` / `mime` | String | File metadata |
| `type` | String | `CODE \| IMAGE \| FILE \| LINK \| NOTE \| VIDEO` |
| `totalBytes` | Int | Total size |
| `chunkSize` / `chunkCount` | Int | Server-decided part size / count (≤3 MB parts) |
| `createdBy` | String | Uploader user id |
| `createdAt` | Int | Epoch ms (not DateTime) |

- Indexed on `createdAt`, `sectionKey`. Written via raw `@libsql/client` (like `rate_limit_events`); Prisma owns the DDL only.

### `WorkspaceUploadChunk`
| Column | Type | Notes |
|---|---|---|
| `uploadId` | String | FK → `WorkspaceUpload.id` |
| `chunkIndex` | Int | 0-based part number |
| `data` | Bytes | Raw decoded part (not base64) |

- Composite primary key `[uploadId, chunkIndex]`. Parts are assembled server-side into the final `WorkspaceFile` once all arrive.

### `WorkspaceFile`
| Column | Type | Notes |
|---|---|---|
| `id` | String (randomUUID) | `fileId` |
| `sectionKey` | String | Owning section |
| `projectId` | String | — |
| `envelopeId` | String? | Null for loose files |
| `itemId` | String | The tree item referencing `file://<id>` |
| `name` / `mime` | String | File metadata |
| `size` | Int | Assembled byte size |
| `data` | Bytes | Assembled raw bytes |
| `createdBy` | String | Uploader user id |
| `createdAt` | Int | Epoch ms |

- Indexed on `createdAt`, `sectionKey`. The drawer tree only keeps a tiny `file://<id>` reference, keeping the shared JSON small.

### `AppConfig`
| Column | Type | Notes |
|---|---|---|
| `key` | String | Primary key |
| `value` | String | Stored value |

- **Currently unused by the codebase** — a legacy placeholder from the old Google-Drive wiring. Kept for schema stability; do not rely on it.

### `Archive`
| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | — |
| `summary` | String | Generated report summary |
| `monthId` | String | FK → `Month.id` (cascade) |
| `createdAt` | DateTime | — |

---

## Schema generation & migrations

- `generator client` uses `prisma-client-js` with the `driverAdapters` preview feature.
- `datasource db` provider is `sqlite` — the Prisma CLI targets the local `file:./dev.db` via `prisma.config.ts` (CLI commands do NOT connect to Turso directly).
- Production (Turso) schema is kept in sync by running one-off `@libsql/client` batch statements outside Prisma CLI, or by pushing `prisma/migrations/` diffs manually. The `prisma db push` and `prisma migrate dev` commands only touch the local SQLite file.

### Seed script

`prisma/seed.ts` (run via `npm run db:seed` or `npm run db:setup`):
1. Wipes **all tables** (goalAssignment, step, notification, comment, goal, archive, month, userSection, sectionConfig, user, approval).
2. Creates the 4 default `SectionConfig` rows.
3. Creates one `ADMIN` user (`admin@team.com` / `admin123`) assigned to all sections, with `primarySection: "MANAGEMENT"`.
4. Creates the current month and one demo goal per section (all by the admin, `deadlineSetByAdmin: true`, deadline = 28th of the current month).

> ⚠️ The seed wipes all data. Use `db:reset` only in development.

### Table-tool seed (dev only)

`dev/seed-tables.mjs` (gitignored, dev-only) seeds a few **mock tables** into Turso for local
testing of the Team Tables tool — idempotent, run with `node --env-file=.env dev/seed-tables.mjs`.
`prisma/seed.ts` does **not** create tables.

---

## Default fallback sections

Defined in `src/types/index.ts` and used when the DB has no `SectionConfig` rows:

| key | label | prefix | color |
|---|---|---|---|
| `MARKETING` | Marketing | `MRK-` | `#FF4D6A` |
| `ART` | Art | `ART-` | `#7C3AED` |
| `TECHNICAL` | Technical | `TEC-` | `#3B82F6` |
| `MANAGEMENT` | Management | `MNG-` | `#F59E0B` |