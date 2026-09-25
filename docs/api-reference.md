# API Reference

All routes are under `/api`. Responses are JSON, **with one exception**: `GET /api/drawers/files/[id]` streams raw bytes. Errors use a consistent shape:

```json
{ "error": "message" }
```

with an appropriate HTTP status (`400`, `401`, `403`, `404`, `409`, `429`, `500`).

## Authentication & Authorization

- Session auth uses an **HttpOnly cookie** named `catarina-token` (JWT, HS256, 7-day expiry, signed with `JWT_SECRET`).
- **Persistent login with rotating refresh tokens**: on success, `POST /api/auth/login` also returns a per-device `refreshToken` (stored by the client in `localStorage["catarina-refresh"]`, hashed server-side in the `RefreshToken` table). Refresh tokens are **single-use and rotate on every call**: each refresh issues a new token and marks the old one spent. Presenting a spent token is treated as theft and **revokes the entire token family**, forcing a fresh login. A family has a hard **30-day ceiling** regardless of activity. When the cookie expires, the client calls `POST /api/auth/refresh`; logout revokes the family server-side.
- Helpers live in `src/lib/api-helpers.ts`, `src/lib/auth.server.ts`, `src/lib/auth-session.ts`, `src/lib/refreshToken.ts`, and `src/lib/refreshPolicy.ts`.
- `requireUser()` → returns `{ ok:true, data: JWT payload }` or a 401 response.
- `requireAdmin()` → same as above but re-reads the role from the DB, so a demoted admin loses admin access immediately (returns 403).
- `requireGoalAccess(userId, role, goalId)` → 404 if the goal doesn't exist, 403 if a non-admin isn't in the goal's section, else `{ ok:true, goal }`.
- The Vercel Edge `src/proxy.ts` runs on `["/dashboard/:path*", "/tools/:path*", "/api/:path*"]` and does two things:
  1. **Auth guard** for `/dashboard/*` and `/tools/*` — verifies the HttpOnly JWT cookie and redirects unauthenticated users to `/`.
  2. **Same-origin (CSRF) guard** for every mutating `/api` request (`POST`, `PUT`, `PATCH`, `DELETE`) — requires the `Origin` (falling back to `Referer`) to match the request host, answering `403` before the handler runs. It **fails closed**: a present-but-opaque (`Origin: null`, e.g. a sandboxed iframe), malformed, or non-HTTP origin is rejected, and a missing `Host` header rejects too. The decision logic lives in `src/lib/originGuard.ts` so it is unit-tested.

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
| `canManageTables` | true | Manage Team Tables (create, edit, delete) |

Admins always have all permissions (`ADMIN_PERMISSIONS`). Parse/resolve via `src/lib/permissions.ts`.

---

## Auth

### `POST /api/auth/register`
Creates a **pending approval request**. The account is not active until an admin approves it.

- Content-Type: `multipart/form-data`
- Fields: `name`, `email`, `password` (min 8, max 200, and not a commonly-breached password), `section` (uppercase section key), `pfp` (optional File; jpg/png/gif/webp, ≤2 MB)
- Rate limited: **3 attempts / 5 min / IP** *and* **3 / 5 min per email** (the per-email key is a SHA-256 hash, so rotating forged IPs cannot bypass it)
- Validations: name ≤100 chars, RFC-ish email regex, section must exist via `getSectionKeys()`, password policy via `asValidPassword` (`src/lib/passwordPolicy.ts`).
- **Create-only.** A `409` with one uniform message is returned if *any* row already exists for that email — a pending request, a rejected request, an earlier approved request, or a registered account. Registration can never overwrite an existing user. An admin can clear a stale request with `DELETE /api/admin/approvals` so that email may try again.
- Notifies admins (`SIGNUP_REQUEST`).
- Response 200: `{ message }`

### `POST /api/auth/login`
- Body: `{ email, password }`
- Rate limited on **two independent layers**: **10 attempts / min / IP** and **10 attempts / 15 min per account** (keyed on a SHA-256 hash of the normalized email, so neither a botnet nor a forged-IP rotation gets more than 10 against one account). Either layer being over its limit answers `429`.
- **Every credential failure returns the same `401` `{ "error": "Invalid email or password" }`** — wrong password, unknown email, rejected signup, and pending signup are indistinguishable. There is no `403` and no per-state message.
- **Timing-safe by construction:** exactly one bcrypt comparison runs on every attempt whether or not the account exists, so response time cannot be used to enumerate accounts.
- On success sets the `catarina-token` cookie, mints a per-device refresh token (hashed into the `RefreshToken` table), and returns 200:
```json
{
  "user": {
    "id": "…", "name": "…", "email": "…", "role": "ADMIN|MEMBER",
    "pfp": "…", "bio": "…", "primarySection": "…", "welcomeSeen": false,
    "permissions": { "canCreateGoals": true, "canEditGoals": true, "canDeleteGoals": true, "canManageMembers": true, "canCreateMonths": true, "canManageTables": true },
    "sections": ["MARKETING", "ART"]
  },
  "refreshToken": "64-char-hex"
}
```
- The client stores `refreshToken` in `localStorage["catarina-refresh"]` for silent re-auth on future visits.

### `POST /api/auth/refresh`
Silently re-issues the session cookie from a device's refresh token (used on app load when `catarina-token` has expired).

- Body: `{ refreshToken }`
- **Tokens are single-use and rotate.** Each successful refresh marks the presented token spent and returns a new one. Presenting an already-spent token is treated as theft: the **entire family is revoked** and the call fails with a generic `401`, so the real user must sign in again.
- **30-day absolute ceiling.** A family's expiry is fixed at creation (`familyCreatedAt + 30 days`); refreshing never extends it. Past that point refresh fails even if the token was never spent.
- Also fails closed with a generic `401` for revoked tokens, unknown tokens, and tokens whose user no longer exists.
- On success sets a fresh `catarina-token` cookie and returns 200:
```json
{ "user": { "id": "…", "name": "…", "email": "…", "role": "…", "pfp": "…", "bio": "…",
            "primarySection": "…", "welcomeSeen": true, "permissions": {…}, "sections": ["…"] },
  "refreshToken": "64-char-hex" }
```
- **The client must persist the returned `refreshToken`**, replacing the old one. Dropping it means the next refresh presents a spent token and revokes the family.
- The user shape matches `/api/auth/login` and `/api/auth/me` exactly (built by `buildAuthUser`).

### `GET /api/auth/me`
- **Always `200`, including when signed out** — it answers `{ "user": null, "hasUpdate": false }` so the client can distinguish "logged out" from "server error" without treating it as a failure.
- Authenticated: returns the fresh user (sections read live from DB) plus update detection against `src/lib/changelog.json`:
```json
{
  "user": { "id": "…", "name": "…", "email": "…", "role": "…", "pfp": "…", "bio": "…",
            "primarySection": "…", "welcomeSeen": true, "sections": ["…"], "permissions": {…} },
  "hasUpdate": false
}
```
  When `hasUpdate` is true it also includes `updateVersion`, `updateType` (`major`|`minor`|`patch`), `updateTitle`, `updateEntries` (`[{ icon, text }]`).
- `src/lib/changelog.json` must contain an entry for the current version or this endpoint falls back to a generic title/entry.
- Side effects: ensures the hardcoded "Why Catarina? 🌸" welcome notification exists; creates a `VERSION_UPDATE` notification when a new version is detected.

### `POST /api/auth/logout`
- Body (optional): `{ refreshToken }`.
- **Revokes the device's refresh token** server-side (best-effort), then clears the auth cookie. Revocation prevents the localStorage token from silently logging the user back in on the next visit.
- Response: `{ success: true }`

### `PUT /api/auth/profile`
Update your own profile. All fields optional:
```json
{ "name": "…", "email": "…", "bio": "…", "pfp": "data:image/png;base64,…",
  "currentPassword": "…", "newPassword": "…" }
```
- `pfp: ""` clears the picture; otherwise `pfp` is a data-URI string ≤ 2,000,000 chars.
- Password change requires `currentPassword` (bcrypt-verified); **rate limited 5 / min / user**. New password: min 8, max 200, max 72 bytes (bcrypt's limit — the 200-char cap is only reachable well under it), and not a commonly-breached password. The policy applies to the **new** password only, so nobody is locked out by an existing weak one.
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
- **Public and unauthenticated** — the registration form lives on the login page, where no session exists yet, and needs the section list to render its dropdown.
- Rate limited: **30 requests / min / IP**.
- Calls `getSections()`, which caches active sections for 30s and falls back to `FALLBACK_SECTIONS` if the DB is empty or unreachable.
- Returns **only the four display fields the form needs** (`src/lib/publicSection.ts`), so no primary keys or internal metadata leak to an unauthenticated caller:
```json
{ "sections": [{ "key": "MARKETING", "label": "Marketing", "color": "#FF4D6A", "prefix": "MRK-" }] }
```
  Note the absence of `id`, `sortOrder`, and `isActive` — that is intentional.
- Admins who need the full set, including inactive sections, use `GET /api/admin/sections`.

### `GET /api/admin/sections`  *(admin)*
- Returns **all** sections — active and inactive — sorted by `sortOrder`. This is what the admin UI uses; it is deliberately separate from the public endpoint above.
- Response: `{ sections: [{ id, key, label, prefix, color, sortOrder, isActive }] }`

### `POST /api/admin/sections`  *(admin)*
- Body: `{ key, label, prefix, color }`
- `key`: 2–12 uppercase letters, e.g. `MARKETING`. `label`: 1–60 chars. `prefix`: 2+ uppercase letters followed by `-`, e.g. `MRK-`, ≤8 chars total. `color`: `#RRGGBB`.
- `409` if key exists. `sortOrder` auto-assigned (max+1). Invalidates the section cache.
- Response 201: `{ section }`

### `PUT /api/admin/sections/[id]` *(admin)*
- Body (any subset): `{ label, prefix, color, sortOrder, isActive }`
- Same format validations as create. Prefix uniqueness checked (`409`).
- `404` if not found (`P2025`). Response: `{ section }`

> **Note:** uniqueness of both `key` and `prefix` is enforced by a read-before-write pre-check, not by a database constraint. It is correct under normal use, but a genuinely concurrent double-submit can slip past it and surface a `500`. `key` additionally carries a real `@unique` constraint in the schema.

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
- **Archives, it does not delete.** Sets `isArchived: true`; goals, steps, comments and archives stay intact and the month remains browsable in the archive report. Nothing is cascaded away.
- Idempotent: re-archiving an already-archived month succeeds as a no-op.
- `404` if the month does not exist. Response: `{ success: true, archived: true }`

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
- Body (any subset): `{ text?, done?, order? }` (text ≤500, `order` ≥0 int). At least one field required, else `400`.
- **Two different capabilities gate this endpoint**, resolved from the step's parent goal:
  - editing `text` or `order` requires **`canEdit`** → `403` otherwise
  - toggling `done` only requires **`canCheck`** → `403` otherwise
- `404` if step missing. Response: `{ step }`

### `DELETE /api/steps/[stepId]`
- Section check plus **`canEdit`** on the parent goal; `403` without it. Response: `{ ok: true }`

---

## Assignments

### `GET /api/goals/[id]/assignments`
- Response: `{ assignments: [{ userId, name, pfp, canCheck, canEdit }] }`

### `PUT /api/goals/[id]/assignments` *(admin)*
- Body: `{ assignments: [{ userId, canCheck, canEdit }] }`
- **`canCheck` and `canEdit` are both required and must be real booleans** — they are never defaulted. Omitting one (or sending a non-boolean) fails the whole request with `400 "canCheck and canEdit must be booleans for each assignment"`. Send both explicitly for every entry.
- **Replaces all assignments** for the goal in a transaction. Validates users exist, else `400`. Response: `{ success: true }`

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
- Email regex validated; password must satisfy the shared policy (min 8, max 200, max 72 bytes, not commonly breached); `409` if email exists.
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
- Query param (optional): `?includeStale=1`.
  - **Default:** PENDING approvals only, newest first — the actionable queue.
  - **`?includeStale=1`:** every status (PENDING, APPROVED, REJECTED), newest first — this is what backs the admin UI's "Previous Requests" card.
- Response: `{ approvals: [{ id, name, email, section, pfp, status, createdAt, updatedAt }] }`

### `PUT /api/admin/approvals`
- Body: `{ id, action: "approve" | "reject" }` (`400` otherwise; `404` if not PENDING).
- **approve:** in a transaction creates a `MEMBER` user (default section pfp via `getDefaultPfp(section)` if none), adds their `UserSection`, marks the approval `APPROVED`. `409` on duplicate email (`P2002`). Notifies the new member (`MEMBER_JOINED`) and admins.
- **reject:** marks the approval `REJECTED`; notifies admins (`SIGNUP_REJECTED`).

### `DELETE /api/admin/approvals`  *(the only way to clear a stale request)*
- Body: `{ id }`. Deletes the approval row outright.
- **Why this exists:** registration is strictly create-only, so once any row exists for an email — pending, rejected, *or* already approved — further signups for that address return `409` forever. Deleting the stale row is what lets that person legitimately try again. Without it, a rejected applicant can never re-register.
- A `404` (`P2025`) if the id does not exist. Response: `{ success: true }`

---

## Tables (The Cabinet)

Tables power **Team Tables** (`/tools/tables`, `src/app/api/tables/**`). All routes require auth;
every write is re-checked against the caller's `canManageTables` flag + section membership
(`src/lib/table/table-permissions.ts`), and `ADMIN` always bypasses. The `cells` and `stickers`
columns are stored as JSON and may arrive as a **JSON string or an already-parsed object** depending
on which writer stored them — normalize with `JSON.parse` when the value is a string.

### `GET /api/tables`
- Lists non-deleted tables, section-scoped for members (empty list if they have no sections), ordered by section then name. Admins see all. Payload excludes `cells`/`stickers` (kept light).
- Response:
```json
{ "tables": [{ "id": "…", "section": "ART", "name": "…", "color": "#00E8A2",
               "isDateBased": false, "createdById": "…",
               "createdAt": "…", "updatedAt": "…" }] }
```

### `POST /api/tables`
- Body: `{ name (≤200), section (key — uppercased), color? (default "#00E8A2") }`.
- **Rate limited: 20 / 5 min / user** (key `mutation:tables:<userId>`).
- Requires `canWriteTable` (`403` otherwise). Creates the default 6×4 grid via `createGrid`.
- Response **201**: `{ table }` (same shape as the list item).

### `GET /api/tables/[id]`
- Read-scoped to role/membership (like goals) + not deleted. Returns the full table with parsed `cells` (`{ cols, rows }`) and `stickers`.
- `404` if missing or soft-deleted. Response: `{ table }`.

### `PATCH /api/tables/[id]`
- Write-checked (`canWriteTable`). Body: **any subset of `{ name?, color?, isDateBased?, cells?, stickers? }`, plus a mandatory `expectedUpdatedAt`** (empty body → `400`).
- **`expectedUpdatedAt` is required, not optional.** It is the `updatedAt` value from the revision the client loaded, and it is what makes concurrent edits safe. Omitting it or sending an unparseable value fails with `400 "Missing or invalid updatedAt (CAS token)"` — a blind write is refused rather than guessed at, because it would silently clobber a peer's work.
- `cells`: `{ cols: number, rows: GridCell[][] }`; rejected with `400` if `rows.length > 200` or `cols > 200` (`MAX_GRID_SIZE`). `stickers`: array of `{ id, sprite, x, y, w?, locked?, mirrored?, state? }`.
- **On a stale write, returns `409`:**
```json
{ "conflict": true, "table": { "id": "…", "updatedAt": "…", "…": "current server state" } }
```
  The client must **rebase** — merge its live edits on top of the returned document — and retry with the new `updatedAt`. Overwriting the returned row instead will just conflict again.
- On success, response: `{ table: { id, section, name, color, isDateBased, createdById, createdAt, updatedAt } }` with a freshly bumped `updatedAt` to use as the next CAS token.

### `DELETE /api/tables/[id]`
- Soft-delete (`deletedAt` set). Allowed for **ADMIN, the creator, or any section writer**.
- Response: `{ success: true }`.

---

## Drawers (The Cabinet)

Drawers store **one shared tree per section** in the Turso database (`DrawerSection`) — no external
storage. All routes require auth (`src/app/api/drawers/**`, logic in `src/lib/drawers.ts` and
`src/lib/workspaceFiles.ts`).

### `GET /api/drawers/workspace`
- Returns the shared workspace for the caller: every registered section they belong to (admins see all) in registry order, each with its stored `projects` tree.
- Unauthenticated → `401` (the client falls back to a local demo).
- Response: `{ sections: [{ key, label, color, projects }] }`

### `POST /api/drawers/mutate`
- Applies tree mutations (create / rename / move / delete drawers, envelopes, items, plus upload-part and assemble-file actions). Writes are **optimistic-locked** per section — a stale `DrawerSection.version` gets `409`.
- Body shape depends on the action; see `src/lib/drawers.ts` + `src/lib/workspaceFiles.ts` for the current payload contract.
- Responses: `{ ok: true }` and/or the updated tree.

### `GET /api/drawers/files/[id]`
- **The one non-JSON endpoint in the API.** Returns the stored blob as **raw bytes**, not a JSON envelope and not base64. Streaming the bytes keeps large files clear of the platform's JSON body cap.
- Scoped to the caller's sections. A caller who may not access the file's section gets `404`, not `403`, so the response is indistinguishable from a missing id.
- Headers:
  - `Content-Type` — the stored mime **only if the bytes re-sniff to a known-safe non-executable image** (`jpeg`, `png`, `gif`, `webp`); otherwise `application/octet-stream`. The stored mime is never trusted; the server decides from the actual bytes.
  - `Content-Disposition` — `inline` for safe images, otherwise `attachment; filename="drawer-file.bin"`. **The stored filename is never echoed** — it is client-supplied and could inject CRLF into the header. Previews still work because the client builds an object URL from a `Blob` over `fetch`.
  - `X-Content-Type-Options: nosniff` — always.
  - `Cache-Control: private, max-age=3600`, `Content-Length`.
- Anything scriptable or document-like (HTML, SVG, XML, or bytes merely *declared* as an image) is forced to download, so drawer bytes are never rendered as a document at the app's own origin.

---

## Notes & invariants

- **Section-scoping is enforced server-side** against live DB data (`getUserContext`), never the JWT snapshot.
- **Admins are DB-reverified** on every admin route (`requireAdmin`).
- **Rate limiting** is a Turso sliding window on the `rate_limit_events` table, shared across Vercel instances. It is **fail-closed**: if Turso errors, the request falls through to a bounded in-memory counter rather than being allowed. In local dev (no `DATABASE_URL`) that in-memory counter is the only store.
- **Per-account limits are keyed on a SHA-256 hash** of the normalized email, so the shared table never holds a plaintext address. The per-IP layer reads only the header named by `TRUSTED_IP_HEADER`; unset, every caller shares one bucket.
- **No filesystem uploads**: avatars/signup photos travel as base64 data URIs stored in the `User.pfp` / `Approval.pfp` columns. Drawer files are stored as raw bytes **in the DB** via chunked uploads, and served back as raw bytes.
- **Tables & drawers are section-scoped server-side** like goals; JSON columns (`cells`, `stickers`, `tree`) must be normalized (string-or-parsed) before use.
- All route handlers log errors with a `[PREFIX]` tag (e.g. `[GOALS_POST]`, `[REGISTER]`).
- Prisma error codes handled: `P2025` → 404 (not found), `P2002` → 409 (unique constraint).