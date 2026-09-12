# API Reference

All routes are under `/api`. Responses are JSON. Errors use a consistent shape:

```json
{ "error": "message" }
```

with an appropriate HTTP status (`400`, `401`, `403`, `404`, `409`, `429`, `500`).

## Authentication & Authorization

- Session auth uses an **HttpOnly cookie** named `catarina-token` (JWT, HS256, 7-day expiry, signed with `JWT_SECRET`).
- Helpers live in `src/lib/api-helpers.ts` and `src/lib/auth.server.ts`.
- `requireUser()` → returns `{ ok:true, data: JWT payload }` or a 401 response.
- `requireAdmin()` → same as above but re-reads the role from the DB, so a demoted admin loses admin access immediately (returns 403).
- `requireGoalAccess(userId, role, goalId)` → 404 if the goal doesn't exist, 403 if a non-admin isn't in the goal's section, else `{ ok:true, goal }`.
- The Vercel Edge `src/proxy.ts` verifies the JWT for every `/dashboard/:path*` page request and redirects unauthenticated users to `/`.

### Roles & permissions

- `ADMIN` — global access; `requireAdmin()` gates all `/admin` routes.
- `MEMBER` — scoped to assigned sections. Granular flags (stored as JSON in `User.permissions`):

| Key | Default | Meaning |
|---|---|---|
| `canCreateGoals` | true | Create goals in assigned sections |
| `canEditGoals` | false | Edit goal details (name, description, current, target) |
| `canDeleteGoals` | false | Delete goals |
| `canManageMembers` | false | Manage member accounts |
| `canCreateMonths` | false | Create new planning months |

Admins always have all permissions (`ADMIN_PERMISSIONS`). Parse/resolve via `src/lib/permissions.ts`.

---

## Auth

### `POST /api/auth/register`
Creates a **pending approval request**. The account is not active until an admin approves it.

- Content-Type: `multipart/form-data`
- Fields: `name`, `email`, `password` (min 6), `section` (uppercase section key), `pfp` (optional File; jpg/png/gif/webp, ≤2 MB)
- Rate limited: **3 attempts / 5 min / IP**
- Validations: name ≤100 chars, RFC-ish email regex, section must exist via `getSectionKeys()`.
- `409` if email already registered or already has a PENDING approval.
- Notifies admins (`SIGNUP_REQUEST`).
- Response 200: `{ message }`

### `POST /api/auth/login`
- Body: `{ email, password }`
- Rate limited: **10 attempts / min / IP**
- `403` + distinct messages for REJECTED (`"Your signup request was rejected by an admin."`) and PENDING approvals.
- On success sets the `catarina-token` cookie and returns 200:
```json
{
  "user": {
    "id": "…", "name": "…", "email": "…", "role": "ADMIN|MEMBER",
    "pfp": "…", "bio": "…", "primarySection": "…", "welcomeSeen": false,
    "permissions": { "canCreateGoals": true, "canEditGoals": true, "canDeleteGoals": true, "canManageMembers": true, "canCreateMonths": true },
    "sections": ["MARKETING", "ART"]
  }
}
```

### `GET /api/auth/me`
- `401` if no valid token. Returns the fresh user (sections read live from DB) plus update detection against `src/lib/changelog.json`:
```json
{
  "user": { "id": "…", "name": "…", "email": "…", "role": "…", "pfp": "…", "bio": "…",
            "primarySection": "…", "welcomeSeen": true, "sections": ["…"], "permissions": {…} },
  "hasUpdate": false
}
```
  When `hasUpdate` is true it also includes `updateVersion`, `updateType` (`major`|`minor`|`patch`), `updateTitle`, `updateEntries` (`[{ icon, text }]`).
- Side effects: ensures the hardcoded "Why Catarina? 🌸" welcome notification exists; creates a `VERSION_UPDATE` notification when a new version is detected.

### `POST /api/auth/logout`
- Clears the auth cookie. Response: `{ success: true }`

### `PUT /api/auth/profile`
Update your own profile. All fields optional:
```json
{ "name": "…", "email": "…", "bio": "…", "pfp": "data:image/png;base64,…",
  "currentPassword": "…", "newPassword": "…" }
```
- `pfp: ""` clears the picture; otherwise `pfp` is a data-URI string ≤ 2,000,000 chars.
- Password change requires `currentPassword` (bcrypt-verified); **rate limited 5 / min / user**. New password min 6 chars, max 200.
- Email change checks uniqueness (`409` if in use).
- Response: `{ user: { id, name, email, pfp, bio } }`

### `POST /api/auth/welcome-seen`
- Sets `welcomeSeen: true`. Response: `{ ok: true }`

### `PUT /api/auth/primary-section`
- Admin only. Body: `{ section }` (must be a valid section key). Sets the admin's highlighted dashboard section. Response: `{ primarySection }`

---

## Users

### `GET /api/users?section=MARKETING`
- `section` query param is **mandatory** (400 if missing).
- Non-admins may only list users in sections they belong to (403 otherwise).
- Returns:
```json
{ "users": [{ "id": "…", "name": "…", "pfp": "…", "sections": ["…"] }] }
```
Ordered by name. Used for the goal assignment picker.

---

## Sections

### `GET /api/sections`
- Any authenticated user (calls `getSections()` which caches active sections for 30s, falling back to `FALLBACK_SECTIONS` if the DB is empty/unreachable).
- Returns: `{ sections: [{ id, key, label, prefix, color, sortOrder, isActive }] }`

### `POST /api/admin/sections`  *(admin)*
- Body: `{ key, label, prefix, color }`
- `key`: 2–12 uppercase letters, e.g. `MARKETING`. `label`: 1–60 chars. `prefix`: 2+ uppercase letters followed by `-`, e.g. `MRK-`, ≤8 chars total. `color`: `#RRGGBB`.
- `409` if key exists. `sortOrder` auto-assigned (max+1). Invalidates the section cache.
- Response 201: `{ section }`

### `PUT /api/admin/sections/[id]` *(admin)*
- Body (any subset): `{ label, prefix, color, sortOrder, isActive }`
- Same format validations as create. Prefix uniqueness checked (`409`).
- `404` if not found (`P2025`). Response: `{ section }`

### `DELETE /api/admin/sections/[id]` *(admin)*
- **Soft delete**: sets `isActive: false`. Response: `{ section }`

---

## Months

### `GET /api/months`
- All months sorted by year/month asc, with goal counts:
```json
{ "months": [{ "id": "…", "name": "…", "year": 2026, "month": 6, "isArchived": false,
               "createdAt": "…", "updatedAt": "…", "_count": { "goals": 5 } }] }
```

### `POST /api/months/create` *(admin — role-gated via `requireAdmin`; the `canCreateMonths` permission flag is NOT enforced here)*
- Body (optional): `{ previousMonthId }`
- Computes the next month (previous month +1, or current month if omitted). `409` if that `year/month` already exists (`@@unique([year, month])`).
- **Carries over unfinished goals** from the previous month (marked `carriedOver: true`, `deadlineSetByAdmin: true`, new `goalNumber`).
- Notifies all users (`MONTH_CREATED`) and carried-goal assignees (`GOALS_CARRIED_OVER`).
- Response 201: `{ month, carriedOver }`

### `DELETE /api/months/[id]` *(admin)*
- Deletes the month (cascades to its goals). `404` on `P2025`. Response: `{ success: true }`

---

## Goals

### `GET /api/goals`
Query params (all optional): `monthId`, `section`, `since` (ISO date → filters `updatedAt > since`).

- Non-admins are scoped to their sections (`403` if the requested `section` isn't theirs, `403` if they belong to no sections).
- Orders by `done` asc, then `deadline` asc. Returns goals with comments (id only), flattened assignments, and ordered steps:
```json
{ "goals": [{
  "id": "…", "name": "…", "description": "…", "goalNumber": 3, "current": 1, "target": 5,
  "done": false, "deadline": "2026-06-30T…", "carriedOver": false, "section": "MARKETING",
  "completedAt": null, "createdAt": "…", "updatedAt": "…", "monthId": "…", "authorId": "…",
  "deadlineSetByAdmin": true,
  "comments": [{ "id": "…" }],
  "assignments": [{ "userId": "…", "name": "…", "pfp": "…", "canCheck": true, "canEdit": false }],
  "steps": [{ "id": "…", "text": "…", "done": false, "order": 0 }]
}]}
```
- **Side effect (only on full loads, no `since`):** sends `DEADLINE_APPROACHING` (≤5 days) and `DEADLINE_MISSED` notifications to assignees, deduped per-goal-per-day.

### `POST /api/goals`
- Body: `{ name, section, monthId, deadline, description?, current?, target? }`
- `name` ≤200, `description` ≤5000, `current` ≥0 int, `target` ≥1 int, `deadline` ISO date.
- Month must exist (`400`). Non-admins must be in the section (`403`) and have `canCreateGoals` (`403`).
- `goalNumber` = max for the section + 1. `deadlineSetByAdmin` = true only for admins.
- Notifies section members (`GOAL_CREATED`). Response **201**: `{ goal }` (same shape as GET).

### `GET /api/goals/[id]`
- Single goal (section check applies). `404` if missing. Serializes `deadline`/`completedAt`/`createdAt`/`updatedAt` to ISO strings. Response: `{ goal }`

### `PUT /api/goals/[id]`
- Body (any subset): `{ name?, description?, current?, target?, deadline? }`
- Non-admins: cannot change the deadline (must match existing value, else `403`), and need `canEditGoals` (`403`).
- Admins setting a deadline mark `deadlineSetByAdmin: true`.
- Response: `{ goal }`

### `DELETE /api/goals/[id]` *(admin)*
- Response: `{ success: true }`

### `PATCH /api/goals/[id]/toggle`
- Body: `{ done: boolean }`
- Sets `done`, sets `completedAt` to now when done (null otherwise), and sets `current = target` when done.
- Notifies other assignees (`GOAL_COMPLETED`) and the rest of the section (`GOAL_REACHED`, excludes actor).
- Response: `{ goal }`

---

## Steps

### `GET /api/goals/[id]/steps`
- Steps for a goal, ordered by `order` asc. Response: `{ steps: [{ id, text, done, order, goalId }] }`

### `POST /api/goals/[id]/steps`
- Body: `{ text (≤500), order? }`. Notifies goal assignees (`STEP_ADDED`, excludes actor). Response **201**: `{ step }`

### `PUT /api/steps/[stepId]`
- Body (any subset): `{ text?, done?, order? }` (text ≤500, `order` ≥0 int).
- Section check via the step's parent goal. `404` if step missing. Response: `{ step }`

### `DELETE /api/steps/[stepId]`
- Section check via the parent goal. Response: `{ ok: true }`

---

## Assignments

### `GET /api/goals/[id]/assignments`
- Response: `{ assignments: [{ userId, name, pfp, canCheck, canEdit }] }`

### `PUT /api/goals/[id]/assignments` *(admin)*
- Body: `{ assignments: [{ userId, canCheck?, canEdit? }] }`
- **Replaces all assignments** for the goal in a transaction. `canCheck` defaults true, `canEdit` defaults false.
- Validates users exist, else `400`. Response: `{ success: true }`

---

## Comments

### `GET /api/goals/[id]/comments`
- Comments ordered by `createdAt` asc, with `author: { name, role }`. Response: `{ comments }`

### `POST /api/goals/[id]/comments`
- Body: `{ text }` (≤2000, required).
- Notifies section members plus all admins (`COMMENT_ADDED`, excludes actor). Response **201**: `{ comment }`

---

## Notifications

### `GET /api/notifications`
Query params (optional): `unread=true`, `since=<ISO>`.
- Ordered by `pinned` desc then `createdAt` desc; `take` 100 (50 when `since` given).
- Response:
```json
{ "notifications": [{ "id": "…", "userId": "…", "type": "GOAL_CREATED", "title": "…",
                      "message": "…", "read": false, "pinned": false,
                      "refId": "…", "refType": "goal", "createdAt": "…" }],
  "unreadCount": 3 }
```

### `PATCH /api/notifications`
- Either `{ markAllRead: true }`, or `{ id, read?, pinned? }` (each value is validated as a boolean).
- Response: `{ ok: true }` or `{ notification }`

### `DELETE /api/notifications`
- Either `{ clearRead: true }`, or `{ id }`. Response: `{ ok: true }`

### Notification types (define in `src/lib/constants.ts` → `NOTIFICATION_TYPES`)
`GOAL_CREATED, STEP_ADDED, MEMBER_JOINED, SIGNUP_REQUEST, SIGNUP_REJECTED, DEADLINE_APPROACHING, DEADLINE_MISSED, GOAL_COMPLETED, SYSTEM, GOAL_REACHED, COMMENT_ADDED, MEMBER_LEFT_SECTION, MEMBER_DELETED, MONTH_CREATED, GOALS_CARRIED_OVER, ROLE_CHANGED, VERSION_UPDATE`

### `POST /api/updates/seen`
- Marks `lastSeenVersion` = current `package.json` version. Response: `{ ok: true }`

---

## Realtime sync

### `GET /api/changes`
Delta-polling endpoint for realtime clients. Query params (optional): `since=<ISO>`, `monthId`, `section`.
- ~3 indexed reads: `MAX(Goal.updatedAt)`, `MAX(SectionConfig.updatedAt)`, `COUNT(Notification)` since `since`:
```json
{ "goalsUpdatedAt": "2026-06-15T10:00:00.000Z", "sectionsVersion": "2026-06-01T…", "newNotifications": 2 }
```
- Clients compare the returned timestamps to a snapshot and fetch full data only when they advance (see `useRealtimeSync.ts` / `useGoalMerge.ts`).

---

## Upload

### `POST /api/upload`
- Content-Type: `multipart/form-data`; field `file`.
- **Rate limited: 20 uploads / min / IP.**
- Accepts jpg/png/gif/webp, ≤2 MB. **Magic-byte sniffing** (header bytes), not the declared MIME.
- Converts to a base64 data URI — **no filesystem writes** (Vercel-safe).
- Response: `{ url: "data:image/webp;base64,…" }`

---

## Admin: Users

### `GET /api/admin/users`
- All users (createdAt asc) with sections, resolved permissions, and counts:
```json
{ "users": [{ "id": "…", "name": "…", "email": "…", "role": "…", "pfp": "…", "bio": "…",
              "sections": ["…"], "permissions": {…}, "createdAt": "…",
              "_count": { "goals": 0, "comments": 0 } }] }
```

### `POST /api/admin/users/create`
- Body: `{ name, email, password, role?, sections?, permissions?, pfp?, bio? }`
- Email regex validated; password min 6; `409` if email exists.
- Permissions: only `PERMISSION_KEYS` booleans accepted, defaulted from `DEFAULT_PERMISSIONS`.
- Sections uppercased, deduped, must be valid (`getSectionKeys()`); invalid ones silently dropped.
- Response 201: `{ user: { id, name, email, role, pfp, bio, permissions, sections } }`

### `PUT /api/admin/users/[userId]`
- Body (any subset): `{ name?, email?, bio?, pfp?, role?, permissions?, newPassword? }`
- Role: `ADMIN`/`MEMBER` only. Guards: cannot demote self (`400`), cannot demote the **last admin** (`400`).
- Email uniqueness checked (`409`). Permissions rebuilt from `PERMISSION_KEYS`.
- `404` on `P2025`. Response: `{ user }`

### `DELETE /api/admin/users/[userId]`
- Guards: cannot delete self (`400`), cannot delete the last admin (`400`).
- **Data-loss guard:** blocks deleting a user who authored goals → `400` with a hint to reassign/remove their goals first.
- Notifies other admins (`MEMBER_DELETED`). Response: `{ success: true }`

### `PUT /api/admin/users/[userId]/sections`
- Body: `{ sections: string[] }` — **replaces all** section assignments.
- Sections uppercased, deduped, validated (`400` lists invalid keys). Done in a transaction.
- Notifies removed users (`MEMBER_LEFT_SECTION`) and the affected sections. Response: `{ sections }`

### `POST /api/admin/users/[userId]/promote`
- Toggles `ADMIN` ⇄ `MEMBER`. Guards: cannot demote self (`400`), cannot demote the last admin (`400`).
- Notifies the user (`ROLE_CHANGED`). Response: `{ user: { id, name, role } }`

---

## Admin: Approvals

### `GET /api/admin/approvals`
- PENDING approvals, newest first. Response: `{ approvals: [{ id, name, email, section, pfp, status, createdAt, updatedAt }] }`

### `PUT /api/admin/approvals`
- Body: `{ id, action: "approve" | "reject" }` (`400` otherwise; `404` if not PENDING).
- **approve:** in a transaction creates a `MEMBER` user (default section pfp via `getDefaultPfp(section)` if none), adds their `UserSection`, marks the approval `APPROVED`. `409` on duplicate email (`P2002`). Notifies the new member (`MEMBER_JOINED`) and admins.
- **reject:** marks the approval `REJECTED`; notifies admins (`SIGNUP_REJECTED`).

---

## Notes & invariants

- **Section-scoping is enforced server-side** against live DB data (`getUserContext`), never the JWT snapshot.
- **Admins are DB-reverified** on every admin route (`requireAdmin`).
- **Rate limiting** is a Turso sliding window on the `rate_limit_events` table, shared across Vercel instances. In local dev (no `DATABASE_URL`) it falls back to an in-memory Map.
- **No filesystem uploads**: avatars/signup photos travel as base64 data URIs stored in the `User.pfp` / `Approval.pfp` columns.
- All route handlers log errors with a `[PREFIX]` tag (e.g. `[GOALS_POST]`, `[REGISTER]`).
- Prisma error codes handled: `P2025` → 404 (not found), `P2002` → 409 (unique constraint).