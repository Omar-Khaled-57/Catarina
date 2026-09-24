# <img src="../public/rina/celebration.webp" width="80" align="center" /> AI Agent Guide

A purpose-built orientation for AI coding agents (and new humans) that need to modify this
codebase safely. Read `docs/api-reference.md`, `docs/data-model.md`, and `docs/developer-guide.md`
for depth; this file is the fast map.

---

## 0. Golden rules

1. **Never trust the JWT's role/section claims.** Server-side checks re-read the DB
   (`getUserContext`, `requireAdmin`) — do the same in new routes.
2. **Never use the Prisma CLI against Turso.** `prisma.config.ts` pins the CLI to `file:./dev.db`;
   the CLI can't reach `libsql://`. Runtime always uses `src/lib/prisma.ts` (libSQL adapter).
3. **The realtime system is delta-based.** Don't return full lists on `/api/changes`; only
   MAX timestamps + notification count. Don't add DB writes to delta-polled routes (they run every 5 s).
4. **`PERMISSION_KEYS` is the allowlist shelf.** New member permission flags must be appended here
   (`src/lib/constants.ts`) or admin user create/update silently drops them.
5. **`NOTIFICATION_TYPES` is the canonical set.** New notification types: add the constant AND cover
   the frontend maps in `NotificationPanel.tsx` (`TYPE_ICON` / `TYPE_COLOR` / `TYPE_IMAGE` / `IMAGE_SIZES`).
6. **Uploads are base64 data URIs, never filesystem writes** (Vercel-safe). Pfps are stored in DB.
7. **Follow the existing API pattern** — `requireUser()`/`requireAdmin()`/`jsonError()` from
   `src/lib/api-helpers.ts`; sanitize inputs; log with a `[TAG]` prefix.
8. **Version bumping** touches four places: `package.json` (version), `src/lib/changelog.json`
   (user-facing entries), `README.md` (badge), and `src/components/Footer.tsx` (footer version chip).
   `src/app/api/auth/me/route.ts` + the update modal read the changelog at runtime.
9. **Do not edit `src/generated/prisma/`** — it's generated output.
10. **Do not touch `plan/`, `dev/`, or `/docs` history** unless asked. `dev/` is ESLint-ignored
    and fully gitignored (nothing in it is committed) and holds private notes.

---

## 1. Repo layout (fast map)

```
prisma/
  schema.prisma           The data model (the source of truth)
  migrations/             SQL migration files (CLI-generated, local dev.db)
  seed.ts                 Wipes DB, seeds 4 sections + admin + demo month
prisma.config.ts          CLI database config (local dev.db ONLY)
src/
  proxy.ts                Edge auth guard for /dashboard/:path* (JWT verify)
  types/index.ts          Shared TS types + FALLBACK_SECTIONS
  lib/                    Shared helpers (no client code — server-safe)
    api-helpers.ts        requireUser/requireAdmin/requireGoalAccess + sanitizers
    auth.server.ts        JWT sign/verify + HttpOnly cookie (server-only imports)
    auth-session.ts       buildAuthUser — shared user shape for login/me/refresh
    refreshToken.ts       Long-lived per-device refresh tokens (hash/verify/revoke)
    auth.ts               Client-safe section constants (SECTIONS, SECTION_LABELS,
                          SECTION_COLORS — derived from FALLBACK_SECTIONS)
    constants.ts          Roles, cookie name, NOTIFICATION_TYPES, PERMISSION_KEYS
    permissions.ts        MemberPermissions (6 flags incl. canManageTables), parse/serialize/resolve
    notify.ts             notify / notifyMany / notifyAdmins / notifySection
    rateLimit.ts          Turso sliding-window limiter (+ in-memory dev fallback)
    sections.ts           getSections() (30s cache) + FALLBACK fallback
    prisma.ts             PrismaClient singleton (libSQL adapter → Turso)
    mergeGoals.ts         Delta merge + temp-goal dedupe (unit tested)
    toastSuppress.ts      Suppress next coming-change toast (own mutation)
    pdf-palette.ts        Report PDF color palettes (dark/light)
    drawers.ts            Drawer workspace tree load/save + optimistic locking
    workspaceFiles.ts     Chunked drawer uploads → assembled WorkspaceFile blobs
    table/                grid.ts · date.ts · pdf.ts · table-permissions.ts (all unit tested)
    tools.ts              Tool registry — single source of truth for /tools cards
    changelog.json        Version → {type,title,entries} for the update modal
  app/
    api/<group>/<…>/route.ts   Every endpoint (see §3)
    layout.tsx            Root providers (Theme/Auth/Toaster/ServiceWorker)
    page.tsx              Login screen
    dashboard/
      layout.tsx          Navbar + Footer + WelcomeModal + UpdateModal
      page.tsx            Overview: section cards + chart + month selector
      [section]/page.tsx  Section board: goals, filters, GoalForm, DonutChart, comments
      archive/page.tsx    Archived months list (admin can delete months)
      archive/[monthId]/page.tsx  Report (Overview/Sections/Performance tabs + PDF export)
      admin/page.tsx      User mgmt + SectionManager + approvals + create/edit modals
    tools/
      page.tsx            The Cabinet — tool card grid (ToolsView)
      tables/             Tables list (page.tsx) + editor (tables/[id]/page.tsx)
      drawers/            Drawers workspace (page.tsx) + storage note
    globals.css           Tailwind v4 @theme design tokens (accent #00E8A2, bg #060B14…)
    manifest.ts, robots.ts, sitemap.ts, icon.png, apple-icon.png
  components/
    ui/                   Button, Card, Badge, Modal, ConfirmModal, ProgressBar, CountUp, InView, PasswordInput
    admin/                CreateUserModal, EditUserModal
    tools/                ToolCard, ToolGrid; tools/tables/* (editor, grid, toolbar, stickers);
                          tools/drawers/* (DrawersWorkshop, SectionChest, Envelope, LooseFile)
    Navbar.tsx            Nav + theme toggle + notification panel + user menu (polls unread)
    GoalCard.tsx          Goal card: progress edit, steps, comments, toggle, deadline status
    GoalForm.tsx, StepsChecklist.tsx, CommentSection.tsx
    MonthSelector.tsx     Month nav + "New Month" (admin) with carry-over
    NotificationPanel.tsx Notification drawer (type→icon/color/image maps live here)
    SectionManager.tsx    Admin section CRUD (create/update/soft-delete)
    …profile, welcome/update modals, DonutChart, SectionCard, AudioPlayer, etc.
  contexts/               AuthContext (client auth state), ThemeContext (catarina-theme)
  hooks/
    usePolling.ts         Adaptive interval (active 5s; idle·3; hidden·6)
    useRealtimeSync.ts    Delta poll /api/changes + exponential backoff (5→10→20→30s)
    useGoalMerge.ts       Merge deltas; glow new IDs (~2s) / pulse sections (~3s)
    useFileUpload.ts      FormData → /api/upload
    useModalA11y.ts       Escape / scroll-lock / focus-trap
    useTableGrid.ts       Table state wrapper: grid ops + debounced save (250ms)
public/
  icons/  rina/   pfps/   media/   sw.js   uploads/
  sw.js   PWA service worker: /api → network-only; static → cache-first;
          /dashboard HTML → network-first; others → stale-while-revalidate
```

---

## 2. Commands

```bash
npm run dev          # dev server
npm run lint         # eslint (config excludes dev/**)
npm test             # node --import tsx --test "src/**/*.test.ts"
npm run build        # prod build
npm run db:migrate   # local dev.db ONLY (prisma migrate dev)
npm run db:push      # local dev.db ONLY (prisma db push)
npm run db:setup     # push + seed  ⚠️ seed wipes the database
npm run db:reset     # migrate reset --force + seed ⚠️ destructive
npm run db:seed      # tsx --env-file=.env prisma/seed.ts ⚠️ destructive
npm run db:studio    # Prisma Studio (local dev.db)
```

There is **no `npm run typecheck`**; `next build` type-checks. Run `npm run lint` and
`npm run build` (or `npx tsc --noEmit`) after changes.

**Turso schema sync (production DB):** edit `prisma/schema.prisma` → update
`turso-push.mjs` (reads `migrate.sql`) or `update-turso-schema.mjs` (inline statements),
then `node --env-file=.env turso-push.mjs`. The CLI never touches Turso.

---

## 3. API surface (grouped — full request/response docs in `docs/api-reference.md`)

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/register` (FormData, creates Approval, RL 3/5min) · `POST /api/auth/login` (sets cookie, RL 10/min, returns `refreshToken` for the device) · `GET /api/auth/me` · `POST /api/auth/refresh` (silently re-issues the cookie from a localStorage refresh token) · `POST /api/auth/logout` (revokes the device refresh token + clears cookie) · `PUT /api/auth/profile` (own profile, pw change RL 5/min) · `POST /api/auth/welcome-seen` · `PUT /api/auth/primary-section` (admin) |
| Sync | `GET /api/changes?since=&monthId=&section=` → `{goalsUpdatedAt, sectionsVersion, newNotifications}` |
| Notifications | `GET /api/notifications?unread=&since=` → `{notifications, unreadCount}` · `PATCH {id,read?,pinned?}|{markAllRead}` · `DELETE {id}|{clearRead}` · `POST /api/updates/seen` |
| Upload | `POST /api/upload` (FormData `file`, RL 20/min, base64 data-URI response) |
| Sections | `GET /api/sections` (active only) · admin: `GET/POST /api/admin/sections`, `PUT/DELETE /api/admin/sections/[id]` (soft delete) |
| Months | `GET /api/months` · `POST /api/months/create` (carry-over unfinished goals) · `DELETE /api/months/[id]` (admin, soft-archives: sets isArchived, data preserved) |
| Goals | `GET /api/goals` · `POST /api/goals` · `GET/PUT/DELETE /api/goals/[id]` · `PATCH /api/goals/[id]/toggle` · `GET/POST /api/goals/[id]/steps` · `GET/PUT /api/goals/[id]/assignments` (admin) · `GET/POST /api/goals/[id]/comments` |
| Steps | `PUT/DELETE /api/steps/[stepId]` |
| Users | `GET /api/users?section=` (assignment picker) · admin: `GET /api/admin/users`, `POST /api/admin/users/create`, `PUT/DELETE /api/admin/users/[userId]`, `PUT /api/admin/users/[userId]/sections`, `POST /api/admin/users/[userId]/promote` |
| Approvals | `GET /api/admin/approvals` · `PUT /api/admin/approvals` `{id, action: approve|reject}` |
| Tables | `GET /api/tables` (section-scoped list) · `POST /api/tables` (RL 20/5min/user) · `GET/PATCH/DELETE /api/tables/[id]` (PATCH = full-document `cells` overwrite, max 200×200) |
| Drawers | `GET /api/drawers/workspace` · `POST /api/drawers/mutate` (optimistic-locked per section) · `GET /api/drawers/files/[id]` |

**Consistent**: error shape `{error}` · 404 on `P2025` · 409 on `P2002` · auth 401 · role 403 ·
section-scope 403 · 429 rate-limited.

---

## 4. Where things live when you get a task

| Task | Touch these files first |
|---|---|
| Add an API endpoint | `src/app/api/<group>/route.ts`, follow `api-helpers.ts` pattern; add to `docs/api-reference.md` |
| Add a Cabinet tool | `src/lib/tools.ts` (registry) → `/tools` card auto-renders; add route handlers under `src/app/api/<tool>/`, components under `src/components/tools/<tool>/` |
| Modify tables tool | `src/lib/table/grid.ts` (pure engine + tests) · `date.ts` · `pdf.ts` · `table-permissions.ts` · UI in `src/components/tools/tables/` |
| Modify drawers tool | `src/lib/drawers.ts` (tree) · `src/lib/workspaceFiles.ts` (chunked uploads) · `src/app/api/drawers/**` |
| Version bump | `package.json` + `package-lock.json` + `src/lib/changelog.json` + `README.md` badge + `src/components/Footer.tsx` chip |
| Add a goal field | `prisma/schema.prisma` → local `db:migrate` → Turso script → `src/types/index.ts` `GoalData` → `GoalForm.tsx` / `GoalCard.tsx` → `validateGoalFields` in `api-helpers.ts` |
| Add a notification type | `src/lib/constants.ts` (`NOTIFICATION_TYPES`) + `NotificationPanel.tsx` maps |
| Add a member permission | `src/lib/constants.ts` (`PERMISSION_KEYS`) + `src/lib/permissions.ts` + admin UI (`CreateUserModal`/`EditUserModal`, `PERMISSION_LABELS`) |
| Change realtime behavior | `src/hooks/useRealtimeSync.ts`, `useGoalMerge.ts`, `usePolling.ts`, `src/app/api/changes/route.ts`, `src/lib/mergeGoals.ts`, `toastSuppress.ts` |
| Rebrand | `NEXT_PUBLIC_TEAM_NAME`, `NEXT_PUBLIC_SITE_URL` env vars; `public/media/banner.png` |
| Section colors / design tokens | `src/app/globals.css` `@theme` (`--marketing`, etc.) + `SectionConfig.color` rows + `src/lib/pdf-palette.ts` for PDF |
| Theme toggle | `src/contexts/ThemeContext.tsx` (persists `catarina-theme`) + `html.dark`/`html.light` in `globals.css` |
| Auth flow | `src/app/page.tsx` + `LoginForm.tsx` + `src/contexts/AuthContext.tsx` + `src/proxy.ts` + `src/lib/auth.server.ts` + `src/lib/auth-session.ts` + `src/lib/refreshToken.ts` |
| Reports / PDF | `src/app/dashboard/archive/[monthId]/page.tsx` (hidden-iframe print) + `src/lib/pdf-palette.ts` |

---

## 5. Invariants you must preserve

- An `ADMIN` always has all permissions; memos about `permissions` JSON are member-only.
- Users with no sections and non-admins: goal/comment/assignment routes return 403.
- The **last admin** can't be demoted/deleted; **self-demotion/self-delete** is blocked;
  **goal authors** can't be deleted while their goals exist.
- Section keys are uppercase; goal prefixes match `^[A-Z]{2,}-$`; hex colors match `^#[0-9A-Fa-f]{6}$`.
- `deadlineSetByAdmin` blocks non-admins from changing deadlines (403 unless value unchanged).
- `canManageTables` (Table tool) is JSON-only, default **true**, ADMIN always bypasses; a member
  without the flag is read-only, and every table/drawer write is re-checked server-side.
- Month carry-over preserves `current/target/deadline`, marks `carriedOver=true`,
  `deadlineSetByAdmin=true`, new ids + fresh goalNumber.
- Welcome notification "Why Catarina? 🌸" is enforced (pinned, audio).
- Rate-limiter sweep margin (10 min) must exceed the longest window (5 min register).
- `JWT_SECRET` missing → server throws at import (`auth.server.ts`).
- The seeded admin (`admin@team.com`) should exist in every fresh environment.

---

## 6. Pitfalls observed in this repo

- **`prisma db push`/`migrate` never reach Turso** — the most common "schema didn't update" trap.
- **Don't delete `P2025`-guarded routes' error handling** — users get raw 500s instead of 404s.
- **`/api/changes` must stay lightweight** — delta polls hit it every few seconds per client.
- **Table JSON columns are string-or-parsed** — `cells`/`stickers` arrive as a JSON string or a
  parsed object depending on the writer; always normalize (`JSON.parse` if string) before use.
- **Base64 pfp in DB grows rows** — bounded by the 2 MB (2,000,000-char) validation at the API layer.
- **Cookie name is duplicated** in `src/lib/constants.ts` and `src/proxy.ts` and
  `src/lib/auth.server.ts` — keep them in sync.
- **`update-turso-schema.mjs` is idempotent-ish** (skips already-applied statements) but reviews
  its generated SQL carefully.
- **`public/uploads` holds old demo images** and is gitignored (`/public/uploads`) — the app no
  longer writes files there.

---

## 7. Docs to consult before editing

- `docs/api-reference.md` — every endpoint, exact bodies/responses.
- `docs/data-model.md` — models, columns, defaults, relations, invariants.
- `docs/developer-guide.md` — setup, scripts, two-DB workflow, security rationale.
- `docs/user-guide.md` — what the app does, from a user's perspective (also useful to sanity-check
  product behavior).