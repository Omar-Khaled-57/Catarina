# <img src="public/rina/logo.webp" width="130" align="center" /> Catarina Changelog

All notable changes, release notes, and version history for **Catarina** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<br />

<div align="center">
  <img src="public/media/work.png" alt="Catarina Workspace Banner" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);" />
</div>

<br />

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.7.1] — 2026-09-25 · *Breach-Ready: The Nine Hardening Fixes*

> 0.7.0 made Catarina *hard to hack*. **0.7.1 makes it hard to stay hacked.** A second adversarial pass found and closed nine real weaknesses — three of them **Critical**: an attacker-supplied IP header could rotate the rate-limit key and brute-force an account indefinitely, login answered ~100× faster for unknown emails than for wrong passwords (a silent account-enumeration oracle), and a **sandboxed iframe sending `Origin: null` walked straight through the CSRF guard**. On top of that: refresh tokens now rotate and are single-use, drawer files can no longer execute as stored XSS, password floors move 6 → 8 with a breached-password blocklist, and the public section endpoint stops handing out internal database identifiers. The initial release gate passed **194 tests**; current follow-up coverage passes **294 tests across 39 suites**.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Critical — Brute Force, Timing & CSRF

- **Rate-limit bypass closed** — the limiter keyed on an IP taken from `x-forwarded-for`/`x-real-ip`, so anyone could send a *different* header value per request and get a *fresh* counter every time. Login brute-force was therefore effectively unlimited. Key derivation now lives in one audited module that only trusts a forwarded header when `TRUSTED_IP_HEADER` is explicitly configured, and **credential routes add a second, per-account layer keyed by an HMAC of the normalized email using `JWT_SECRET`** — no plaintext email is stored in `rate_limit_events`, and a database-only reader cannot precompute email guesses. Login: 10 failed attempts per account in 15 minutes (the next request is refused before bcrypt) *and* 10/min per IP. Register: 3/5min per account *and* per IP.
- **The limiter no longer fails open** — a Turso error used to log-and-allow, removing brute-force protection for exactly as long as the database was unhealthy. It now falls through to a bounded in-memory counter (10 000 keys, oldest-first eviction) so a database hiccup degrades the limit instead of deleting it.
- **The account lockout is now actually 15 minutes** — found by a documentation audit of this release, and worth stating plainly because the headline above promised 10/15min. The housekeeping sweep deleted *every* event older than a 10-minute margin, so account events 10–15 minutes old were being discarded while still inside their live window and the real lockout was nearer 10 minutes. The margin is now 20 minutes — above the longest window plus serverless clock skew — and the constant is **exported and asserted** by the test suite, which previously "passed" only because it exercised a 5-minute window that no route uses. Any future window widening now fails the build rather than silently weakening the limit.
- **Login timing no longer enumerates accounts** — an unknown email returned before `bcrypt` ran, so it answered ~100× faster than a wrong password despite returning the identical 401. Every attempt now performs exactly one cost-12 comparison; unknown accounts are compared against a throwaway hash of a discarded random secret, so both paths cost the same and neither can authenticate.
- **`Origin: null` no longer bypasses CSRF** — a sandboxed iframe (and `data:` documents) send the literal header `Origin: null`, which failed URL parsing and was treated as "no origin" → **allowed**. Any origin that is *present* must now be valid and must match; only total absence is treated as a non-browser client. Missing `Host` now fails closed. The decision moved into a pure, 20-case-tested `originGuard` module.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Session & Data Integrity

- **Refresh tokens rotate and are single-use** — a stolen refresh token is now useless after one exchange. Each token belongs to a `familyId`; presenting an already-used token **revokes the entire family** (the standard reuse-detection response to token theft). `expiresAt` gives every family an absolute 30-day ceiling. Client and server exchange the token together, so a rotation can no longer be silently dropped.
- **Stored XSS via drawer files closed** — uploads are re-served from `/api/drawers/files/[id]`, and a file stored as `text/html` or SVG would have rendered as a document at the app origin. The server now decides inline-vs-download from **magic bytes, never the client-declared MIME**, with `attachment` + `nosniff` as the fallback and no filename echoed into headers.
- **Team-table lost updates fixed** — concurrent edits silently overwrote each other. Saves now use compare-and-swap on `updatedAt` and return **409** with the current table so the UI can reconcile instead of clobbering.
- **Registration can no longer overwrite an existing account** — the create path used an upsert keyed on email, which could rewrite the approval row of an already-registered user. It is now strictly create-only, with a uniform conflict message (no account-enumeration leak) and a `P2002` race guard. Stale requests are resolved by the **admin deleting them** from a new *Previous Requests* panel.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Passwords & Dependencies

- **Password floor 6 → 8, plus a blocklist** — new passwords only; existing hashes are never re-validated, so **nobody is locked out**. The ~45 most common breached passwords (`password123`, `1234567890`, `qwerty123`, …) are refused case-insensitively. Deliberately **no** composition rules — forced character classes mostly produce predictable variants like `Password1!`. All password inputs now share one constant, so the client can never disagree with the server again.
- **Four vulnerable transitive dependencies pinned** (`brace-expansion` ×2, `js-yaml`, `fast-uri`) — high-severity advisories in the ESLint toolchain, **9 → 6** high findings, none left in code that ships.
- **`prisma` moved to devDependencies** — the CLI is a build-time tool, not a runtime dependency. The runtime client (`@prisma/client`) is untouched.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Honesty & Hygiene

- **A false security claim was removed.** The CSP header was documented as backed by per-request nonces. It is not — nonces are unimplemented, and `'unsafe-inline'` remains required for Next's inline hydration payload. The comment now says so plainly and points at the real primary control (server-side byte sniffing). **The policy itself is unchanged.**
- **The public `/api/sections` endpoint stopped leaking internals** — it must stay unauthenticated (the registration form runs before login), but it no longer serializes full database rows. Anonymous callers now receive only `key`, `label`, `color`, `prefix` — no primary keys, no `sortOrder`/`isActive`. Admins get the full set from the authenticated endpoint. It is also rate-limited now.
- **A dead allowlist was corrected** — the inline-display MIME set advertised video, audio, PDF and AVIF support that the byte-sniffer cannot verify, so those entries were unreachable and misleading. The set now matches the sniffer exactly.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Follow-up included in 0.7.1 — 2026-09-26

- **The account limit now stops at exactly 10 failures** — the eleventh guess is rejected before password comparison. Account keys use secret-keyed HMAC-SHA-256, not a reversible-by-dictionary plain email hash.
- **Table editing is more resilient** — merging over existing merged cells no longer leaves orphaned covered cells; weekday names and abbreviations are recognized as date axes; the modal stack traps focus and Escape closes only the topmost dialog.
- **Sticker controls are complete** — wheel resizing uses a small bounded step, plus/minus resizing respects minimum and maximum sizes, and the picker includes categorized Rina/decorative sprites plus a live “you” profile-photo sticker.
- **Developer seed helper** — `dev/seed-month.mjs` adds sample goals, steps and drawer projects/envelopes/files (including stored file bytes) to the newest month. It is additive and idempotent, has a `--dry-run` mode, and is a local gitignored helper rather than shipped application code.
- **Updated verification** — `tsc --noEmit`, ESLint, production build, and **294/294 tests across 39 suites** pass. This includes account-limit boundary and keyed-HMAC regression coverage.
- **Turso outages fail clearly** — auth-context, month, notification, and drawer reads return a retryable `503` instead of an uncaught `500`; drawer writes are not automatically replayed when the commit result is uncertain. `/api/auth/me` no longer waits for nonessential notification maintenance, and section reads coalesce concurrent queries, reuse last-known data, and back off retries.
- **Database locality options** — Vercel Functions target `hnd1` (Tokyo), near this Turso database. Local development can opt into `DEV_DATABASE_URL` for both Prisma and rate limiting; it is a separate database and is not populated from Turso automatically.
- **LCP hint corrected** — the above-the-fold navbar and login logos load eagerly.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Verification

- **Full suite green at the release gate** — `tsc --noEmit`, ESLint, **194/194 tests across 26 suites** (up from 126), and a production build. The 0.7.1 follow-up above raises this to **294 across 39 suites**; 194 is the figure the initial gate actually passed.
- **Every fix is regression-tested** — the new pure policy modules (`rateLimitPolicy`, `loginPolicy`, `passwordPolicy`, `originGuard`, `registrationPolicy`, `publicSection`) are each covered by unit tests, including the adversarial cases: `Origin: null`, hostname-spoofing prefixes, timing-path parity, and a projected payload that cannot widen when a column is added.
- **Every document was re-checked against the code** — all eight docs plus the schema comments, the in-app changelog, and the env template. That pass is what surfaced the sweep-margin defect above, along with documentation that had drifted from the code: refresh tokens still described as never expiring, a `db:push` step that claimed to push to Turso (it cannot), password minimums of 6, month deletion described as a cascade when it archives, the file endpoint described as returning JSON when it streams raw bytes, the table-save CAS contract missing entirely, and three separate claims that the rate limiter "fails open" when it does the opposite.

### <img src="public/rina/update.webp" width="80" align="center" /> ✦ Known Limitations (honest disclosure)

- **CSP still allows `'unsafe-inline'`.** Nonce-based CSP would remove it but needs plumbing through the edge proxy and App Router; until then the CSP is defence-in-depth only — it blocks remote and `eval`'d script, **not** injected inline script. Byte sniffing is the primary XSS control.
- **Seven advisories remain in the Prisma CLI dependency graph** (six high, one moderate; including `mysql2`, `find-my-way`, and related packages). The offered remediation is a **breaking downgrade to Prisma 6.x**, which is rejected. `prisma` is a development dependency and optional peer of `@prisma/client`; `npm audit --omit=dev` still reports this optional-peer graph, so production reachability was not independently established by that command.
- **No automated SAST or secret scan was run for the follow-up.** Semgrep and Gitleaks are unavailable in the audit environment; manual review and regression tests were used instead.
- **Turso reachability remains external to the app.** A connection timeout to the database host can still produce a retryable `503`; region placement reduces deployment RTT but cannot repair an outage or the developer machine's network path.
- **Requires a one-time production migration** (`refresh_token_rotation`) — additive, and safe to apply while 0.7.0 is live.

<br />

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.7.0] — 2026-09-24 · *Security Hardening*

> No weak point. This release makes Catarina **harder to hack** than it is to use: strict security headers and a real CSP on every response, a same-origin edge guard that answers **403 before any cross-origin mutating API call reaches a handler**, rate limits on the entire public auth surface (login, register, password change, refresh, logout — 10/min per IP), a loud boot-time warning on short or guessable `JWT_SECRET` values, and the auth/crypto surface re-audited route-by-route. Next.js is patched to **16.3.6**, clearing the critical unauthenticated RCE (plus the sharp/libvips, postcss and nanoid advisories) — Prisma deliberately stays 7.x because the audit's "fix" was only a downgrade.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Headers, CSRF & Boot Hygiene

- **Security headers on every response** — a strict CSP (`script-src 'self' 'unsafe-inline'` and nothing else — no remote origins, no `eval`), `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `nosniff`, `DENY`, `strict-origin-when-cross-origin`, plus **HSTS** (`max-age` 6 months, `includeSubDomains`, `preload`) in production.
- **Same-origin edge guard** — every mutating `/api` call (POST/PUT/PATCH/DELETE) whose `Origin` doesn't match the request host answers **403 at the edge**, before the handler runs; the HttpOnly session cookie stays `SameSite=Lax`. No weak point to wire route-by-route — one file covers all of them, now and future.
- **Rate limited auth** — login, register, password change, refresh and logout are each throttled to **10 requests/minute per IP** (429 beyond that), grinding down the entire public auth surface.
- **Weak-​secret boot warning** — a short or guessable `JWT_SECRET` is surfaced loudly at startup (`⚠️ WEAK JWT_SECRET`), while a *missing* one still fails hard, so a dev never ships with a forgeable token.
- **Dependencies** — `next` patched `16.2.11 → 16.3.6` (critical RCE, sharp/libvips, postcss, nanoid). Prisma stays `^7.x` — the audit's suggested "fix" for `@prisma/*` was a **downgrade to 6.19.3**, rejected.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Re-verified, route by route

- **Every input validated** — no untrusted data reaches an execution sink; magic-byte sniffing + 2 MB cap + no-SVG stays on uploads, 72-byte cap on bcrypt, `rateLimit` fail-open on Turso error *(as of this release — 0.7.1 inverted this to fail-closed; see above)*.
- **CSP blocks the eval vector** — the dominant XSS path (attacker-controlled remote/eval script) is cut; the pragmatic inline allowance is Next RSC hydration, no exceptions for remote origins.
- **Full suite green** — lint, `tsc --noEmit`, tests (113+), and a production build pass before this ships.

<br />

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.6.1] — 2026-09-24 · *One-Time Login & Password Toggle*

> Sign in once and stay signed in. The short-lived HttpOnly session cookie no longer strands returning users on the login page — a long-lived per-device refresh token (kept in `localStorage`) is silently exchanged for a fresh cookie on every visit, and already-authenticated users are redirected straight to the dashboard.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ One-Time (Persistent) Login

- **Per-device refresh tokens** — a successful login now mints a long-lived random token, stored hashed in the database (new `RefreshToken` table) and kept as `localStorage["catarina-refresh"]` on the device. No expiry — it lasts until logged out.
- **Silent re-issue on every visit** — when the session cookie has expired, the app exchanges the device token for a fresh cookie via `POST /api/auth/refresh`; the user lands inside the app without re-entering credentials.
- **No more login flash** — the login page checks the live session server-side and redirects to `/dashboard` (client-side fallback handles the just-refreshed case).
- **Real logout** — `POST /api/auth/logout` now revokes the device's refresh token server-side before clearing the cookie, so signing out is a genuine sign-out (no silent re-login on the next visit).
- **Shared user shape** — login, `/api/auth/me`, and `/api/auth/refresh` all build the client user via one helper (`buildAuthUser`) using the canonical `resolvePermissions` (fixes admins missing `canManageTables` in API responses).

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Show/Hide Password Toggle

- **`PasswordInput` component** — a reusable field with an eye toggle (lucide `Eye`/`EyeOff`) that inherits each location's existing styling.
- **Applied everywhere passwords appear** — sign-in & registration (`LoginForm`), profile change-password (current/new/confirm in `ProfileModal`), and the admin create/edit user modals.

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.6.0] — 2026-09-15 · *The Cabinet — Drawers & Team Tables*

> 0.5.0 was skipped — Drawers (originally planned for 0.5.0) and Table (planned for 0.6.0) ship together now, behind one playful new hub: **The Cabinet**.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ The Cabinet

- **New tool hub** — the navbar now carries a Cabinet entry (`/tools`) hosting Catarina's tools as colorful cards (Drawers, Table), each with its own accent color, tagline, and landing page. The hub is registered in a single tool registry (`src/lib/tools.ts`), so future tools drop in with one entry.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Drawers — the team workspace

- **One chest per section** — every project pulls out like a drawer; **envelopes** tuck the fiddly sub-things inside and **loose files** ride on top.
- **Fully cloud-backed** — drawer trees live in the same Turso database the app already uses (`DrawerSection`), so no OAuth or external storage service is needed and every teammate opens the same drawer.
- **Chunked uploads** — files are split into ≤3 MB raw-byte parts (safely under platform body caps) and reassembled server-side into a single stored blob (`WorkspaceFile`); the tree only keeps a small `file://` reference.
- **Optimistic locking** — per-section tree `version` counters make concurrent edits safe (stale writers get a 409).
- **Permanent deletes** — removing a drawer, envelope, or file purges its bytes for the whole team, with no undo.

### <img src="public/rina/celebration.webp" width="80" align="center" /> ✦ Team Tables

- **Free-form grid** — one named table per section (default 6×4). Add/delete rows and columns, type into any cell, and **merge** a selected rectangular region or **split** a merged cell back apart (spans shrink cleanly when lines are deleted).
- **Select & resize** — tap a cell edge to select a whole row/column; **hold or drag** an edge to resize it (clamped 48–640 px), and double-click an edge to restore auto-size. Release anywhere to stop.
- **Date mode** — toggle it on and Catarina auto-detects the date axis; today's whole column (dates in the header) or row (dates in the first column) lights up in the table's accent — even under merged cells.
- **Rina stickers** — drop character stickers on the canvas; they dance (wobble), and clicking cycles play → pause → tilted pose. Drag moves them, hover controls offer lock/mirror/delete, and positions persist.
- **Themed PDF export** — A4 dark or light, portrait/landscape/auto orientation with a smarter fit heuristic, today-strip and merges preserved, stickers optionally frozen onto the print.

### <img src="public/rina/thumb.webp" width="80" align="center" /> ✦ Permissions

- **Manage Team Tables flag** — new per-member `canManageTables` (default `true`, label "Manage Team Tables"); admins always bypass it. Members without the flag view tables read-only, and every write is re-checked server-side (`canWriteTable`).

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Cleanup & Docs

- **Removed the standalone showcase** — `public/features-and-functions.html` (a static features page) is gone; the `docs/` suite now covers everything live.
- **Dev scaffolding tidied** — stale prototypes, mockups, legacy sheets, and one-off scripts were cleared out of `dev/` (the 0.6.0 specs and useful scripts remain).
- **Docs refreshed** — README, changelog (MD + JSON), and every doc (user guide, API reference, data model, developer guide, AI-agent guide) updated to 0.6.0, decorated with Catarina stickers.

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.5] — 2026-09-06 · *Self-Hosted Rate Limiting*

> Upstash paused the free Redis project for inactivity, so rate limiting now lives in the same Turso database the app already uses — one less external service, nothing to keep alive, no pause/archive cycle.

### ✦ Rate Limiter Migration (Upstash → Turso)

- **Dropped Upstash Redis**: `src/lib/rateLimit.ts` no longer uses `@upstash/redis` / `@upstash/ratelimit` — deps removed.
- **Turso sliding window**: rate-limit checks now record an event row in the new `rate_limit_events` table and count in-window attempts. All statements run in **one atomic SQLite transaction** (via `client.batch(..., "write")`), so concurrent Vercel instances can't undercount the window.
- **True sliding-window semantics**: blocked attempts are recorded and age out — identical behavior to `@upstash/ratelimit`.
- **Self-cleaning**: per-key sweep on every check plus a throttled global sweep (margin > longest window) keep the table bounded.
- **Fail-open**: a Turso hiccup logs (throttled) and allows the request instead of 500-ing the route; in-memory fallback still covers environments without `DATABASE_URL`.
- **No config change**: uses existing `DATABASE_URL` + `TURSO_AUTH_TOKEN`. Removed `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` from `.env.example`.
- **Migration**: `20260906000000_add_rate_limit` adds the `rate_limit_events` table (applied to Turso and `dev.db`).
- **Tests**: new `src/lib/rateLimit.test.ts` exercises the real SQL — window boundaries, aging, per-key isolation, sweep retention, and `retryAfterMs`.

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.4] — 2026-08-04 · *Security Hardening & Reliability*

> **Release Highlight:** Patch release hardening API security — section data isolation, database-verified roles, fail-fast auth, and guards against self-lockouts and data loss — plus reliability fixes and a full unit-test suite.

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Security Hardening

- **Section Data Isolation**:
  - `GET /api/goals` now scopes results to the caller's assigned sections — members can no longer read every section's goals by guessing query parameters.
- **Database-Verified Roles**:
  - Admin checks (`requireAdmin`) re-read the role from the database instead of trusting the JWT role snapshot.
- **Fail-Fast Auth**:
  - The app now throws at startup if `JWT_SECRET` is missing — no more silent default-secret fallback.
- **Admin Lockout Guards**:
  - Admins can no longer demote themselves, or demote/delete the last remaining admin.
- **Data-Loss Guard**:
  - Deleting a user who has authored goals is blocked with a clear error (it would cascade-delete their goals).
- **Duplicate-Email Handling**:
  - Approving a signup for an email that already exists now returns a clean 409 instead of an unhandled crash.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Input Validation

- **Admin Sections**: key/prefix/color format checks, label length caps, and `sortOrder`/`isActive` coercion with rejection on invalid values.
- **Registration**: email format, password minimum length, name length, and section normalization.
- **Profile**: name/email/bio/password length limits.
- **Goals**: the target month is verified to exist before a goal is created — no more orphaned rows.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Reliability Fixes

- **Transient Duplicate Goal**:
  - Optimistic "temp" goals now dedupe cleanly against realtime deltas — a goal no longer flashes twice while its POST resolves.
- **Client Fetch Handling**:
  - All pages and components now check `res.ok` — failed requests surface errors instead of silently rendering empty state.
- **Circular Import**:
  - Extracted the audio player into its own component to break a notification-module circular dependency.
- **Lint Fix**:
  - Resolved the build-blocking `react-hooks/set-state-in-effect` error; dashboard section pulses are now derived from merge state during render.
- **Dead Code**:
  - Removed the unused zustand dependency and the dead `onNotificationCount` parameter.

### <img src="public/rina/thumb.webp" width="80" align="center" /> ✦ Testing

- **30 Unit Tests**:
  - Goal merge + temp-goal dedupe, permissions, and shared utilities — including a real bug fix uncovered while testing (deadline status math).

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.3] — 2026-07-28 · *Self-Hosting & Production Hardening*

> **Release Highlight:** Patch release making Catarina fully deployable by any team — dynamic branding, production rate limiting, proper migration workflow, and a complete self-hosting guide.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Self-Hosting & Deployment

- **`NEXT_PUBLIC_SITE_URL` Env Var**:
  - Added site URL env var used across metadata, sitemap, robots, and OpenGraph tags. No more hardcoded domain.
- **Dynamic Web Manifest**:
  - Replaced static `public/manifest.json` with `src/app/manifest.ts` that reads `NEXT_PUBLIC_TEAM_NAME` and `NEXT_PUBLIC_SITE_URL`. PWA branding is now fully configurable.
- **Team-Agnostic Seed Script**:
  - Rewrote `prisma/seed.ts` with generic demo goals (no Devora-specific content). New deployments get a clean starting point.
- **`db:setup` Script**:
  - Added `npm run db:setup` for first-time setup — applies migrations and seeds in one command.
- **README Overhaul**:
  - Complete rewrite with platform links, Catarina stickers in steps, updated scripts table, and full Vercel deploy guide.

### <img src="public/rina/thumb.webp" width="80" align="center" /> ✦ Production Rate Limiting

- **Upstash Redis Integration**:
  - Replaced in-memory `Map`-based rate limiter with Upstash Redis sliding window (`@upstash/ratelimit` + `@upstash/redis`).
  - Rate limits now persist across all Vercel cold starts — brute-force attacks are actually blocked.
  - Falls back to in-memory for local development (zero config needed).
- **Async Rate Limiter**:
  - `checkRateLimit()` is now `async` — callers in login and register routes updated with `await`.

### <img src="public/rina/note.webp" width="80" align="center" /> ✦ Database Migrations

- **Catchup Migration**:
  - Created `20260728000000_catchup_add_tables_and_columns` to sync migration history with the current schema (UserSection, GoalAssignment, Step, Approval, Notification, SectionConfig).
- **Migration Scripts**:
  - Added `db:migrate`, `db:deploy`, `db:status` to `package.json` for proper Prisma workflow.
- **Schema Update Guide**:
  - Added `dev/SCHEMA-UPDATE-GUIDE.md` documenting the full schema update workflow for the team.

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Cleanup

- **Git Cleanup**:
  - Removed `.agents/` and `.kilo/` from git tracking (already in `.gitignore`).
- **Branding Cleanup**:
  - Removed all hardcoded `catarina-devora.vercel.app` and `Devora` references from source code. All now read from env vars.
- **Features Documentation**:
  - Added `public/features-and-functions.html` — interactive page showcasing all Catarina features with stickers and demos.

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.2] — 2026-07-27 · *Notification Modal & Goal Highlighting*

> **Release Highlight:** Patch release adding a full notification detail modal, section-colored goal highlight deep-links, styled form controls, security hardening, and accessibility improvements.

### <img src="public/rina/update.webp" width="80" align="center" /> ✦ Notification Modal & Deep Links

- **`NotificationModal` Component**:
  - Tap any notification to expand full details — type badge, image, full message, timestamp, and type-specific actions.
  - Goal notifications fetch and display complete goal data: name, description, progress bar, deadline, section, steps checklist, assignees, and goal ID.
  - VERSION_UPDATE notifications render the full changelog from `changelog.json` as inline lines.
  - "View Goal" button deep-links to the goal's section page with auto-scroll and colored pulse highlight.
- **Panel Integration**:
  - Added Eye "View" button to every notification item (mobile + desktop).
  - "View Goal" now closes both the modal and the notification panel before navigating.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Goal Highlight System

- **Section-Colored Pulse**:
  - Deep-linked goals pulse with the section's accent color (6 pulses × 0.85s = 5.1s).
  - Overdue goals pulse red, urgent/deadline-approaching goals pulse amber.
- **Scroll-to-Goal**:
  - Section page reads `?goalId=` URL param, smooth-scrolls to the goal element, and auto-clears the param after the highlight ends.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Form UI Polish

- **Assignee Checkboxes**:
  - Replaced raw `<input type="checkbox">` with styled pill-button toggles for "Check" and "Edit" permissions.
  - Main assignee toggle uses `checkbox-pulse` animation and larger hit target.
- **Select Dropdowns**:
  - Custom `.select-glass` class with accent-colored dropdown arrow on focus.
  - Month selector no longer prepends section prefix (e.g. "July 2026" instead of "ART-July-2026").

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Security & Stability

- **JWT Secret Hardening**:
  - Removed hardcoded fallback secret from `auth.server.ts`; rotated to secure 128-char hex in `.env`.
- **Rate Limiting**:
  - Added sliding-window rate limiter — 10 attempts/min for login, 3 attempts/5min for register.
- **Auth Middleware**:
  - Added `src/middleware.ts` for edge-based JWT guard on `/dashboard/*`, removing client-side `useEffect` redirect flash.
- **Goal Create Fix**:
  - `POST /api/goals` now returns `comments`, `assignments`, and `steps` in the response, preventing runtime crash on new goal creation.
- **GoalForm Month Binding**:
  - GoalForm now pre-selects the currently viewed month, preventing goals created for a different month from vanishing on refresh.

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Bug Fixes

- **Next.js 16 Proxy Migration**:
  - Renamed `middleware` function to `proxy` in `src/proxy.ts` to comply with Next.js 16 deprecation.
- **Scrollbar Glow Fix**:
  - Fixed scrollbar hover glow not working in Chrome/Edge by separating WebKit and Firefox scrollbar styles with `@supports` queries.
  - Main app scrollbar and modal scrollbar now both glow accent teal on hover.

### <img src="public/rina/thumb.webp" width="80" align="center" /> ✦ Cleanup & Performance

- **Dead Dependency Removal**:
  - Removed `recharts`, `jspdf`, `jspdf-autotable` (~350KB saved, 41 packages removed).
- **Dead Code Removal**:
  - Deleted `GoalRow.tsx`, `oldNavbar.txt`, `oldNavbar-preview.txt`.
- **Server Components**:
  - Converted login page and 404 to Server Components; extracted `LoginForm.tsx` and `NotFoundContent.tsx` as client components.
- **Accessibility**:
  - Added `aria-live="polite"` to stats bar, section cards grid, goal cards grid, and notification badges.
- **Modularity**:
  - `FALLBACK_SECTIONS` in `types/index.ts` is now the single source of truth for section definitions.

---

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.1] — 2026-07-26 · *PDF Export & UI Refinements*

> **Release Highlight:** Patch release fixing PDF export layout, reinforcing print styling, and polishing responsive dashboard/report UI behavior.

### <img src="public/rina/bug-fix.webp" width="130" align="center" /> ✦ Patch Fixes

- **PDF export background and page sizing**: corrected A4 print styling to preserve report colors and inner padding.
- **Notification sticker refresh**: added new Catarina sticker assets for notification types like goal creation, deadline alerts, comments, and role changes.
- **Responsive dashboard and mobile menu polish**: verified notification/menu layout and section card spacing for smaller screens.
- **Changelog sync**: version bump and release notes updated.

## <img src="public/rina/update.webp" width="120" align="center" /> [0.4.0] — 2026-07-26 · *Realtime Sync & Live Collaboration*

> **Release Highlight:** Minor release introducing low-latency real-time change detection, delta fetching, adaptive smart polling, and optimistic UI mutations. Team changes across goals, sections, and notifications sync seamlessly within 5 seconds without full page refreshes.

### <img src="public/rina/update.webp" width="100" align="center" /> ✦ Real-Time Change Detection Engine

- **Lightweight Delta Endpoint (`GET /api/changes`)**:
  - Implemented high-efficiency telemetry endpoint returning `MAX(updatedAt)` timestamps for goals, section configuration versions, and unread notification counts (~3 row reads per check).
- **Delta Fetching Logic**:
  - Added `?since=<ISO_TIMESTAMP>` query parameter to `GET /api/goals` and `GET /api/notifications` routes to fetch only items modified after the specified timestamp.
- **Prisma `@updatedAt` Schema Support**:
  - Added `updatedAt` field to `Goal` model with automatic Prisma `@updatedAt` trigger for instant change detection.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Smart Adaptive Polling

- **`usePolling` Custom Hook**:
  - Built adaptive interval polling hook: **5s** when tab is active, **15s** when idle, and **30s** when tab is backgrounded. Triggers immediate update on window/tab focus.
- **`useRealtimeSync` Custom Hook**:
  - Created composite hook orchestrating polling, change detection, and delta merging with existing local state.
- **Visibility Detection**:
  - Automatically suspends polling execution when tab is hidden to conserve bandwidth and system resources.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Optimistic Mutations & Immediate Feedback

- **Instant Goal Creation**:
  - Newly created goals appear immediately on the board with a temporary client ID, seamless replace on server response, and automatic rollback on failure.
- **Instant Deletion & Updates**:
  - Immediate removal or property updates applied to goal cards with automatic rollback if API fails.
- **Instant Section Assignment**:
  - Member assignment changes apply instantly on UI before network resolution.

### <img src="public/rina/celebration.webp" width="130" align="center" /> ✦ UX Shimmer & Visual Cues

- **`GoalCard` Shimmer Glow**:
  - Incoming external goal changes shimmer with a subtle 2-second Neon Teal (`#00E8A2`) glow animation.
- **`SectionCard` Pulse**:
  - Dashboard section cards pulse softly for 3 seconds when goals in that section are updated by teammates.
- **Navbar Rate-Limited Toasts**:
  - Incoming changes emit rate-limited toast alerts (max 1 toast per 10s window) via `Sonner`.

### <img src="public/rina/thumb.webp" width="80" align="center" /> ✦ Caching & Performance Polish

- **Static Asset Caching**:
  - `/rina/`, `/pfps/`, and `/fonts/` directories configured with immutable `Cache-Control` header caching.
- **Service Worker v3**:
  - Pre-caches all `/rina/` expression stickers and dashboard shell; network-first strategy for dynamic data; stale-while-revalidate for static pages.

---

## <img src="public/rina/think.webp" width="100" align="center" /> [0.3.2] — 2026-07-25 · *Code Quality & Modularization*

> **Release Highlight:** Patch release focused on modular component extraction, centralized type definitions, accessibility compliance, and zero lint warnings across the codebase.

### <img src="public/rina/update.webp" width="80" align="center" /> ✦ Component Extraction

- **`DonutChart` Component**:
  - Extracted inline SVG donut chart into dedicated reusable component `src/components/DonutChart.tsx`.
- **`SectionDetail` Component**:
  - Extracted section statistics detail view from archive page into `src/components/SectionDetail.tsx`.
- **Admin Modals**:
  - Decomposed 660-line admin page into focused components (`CreateUserModal.tsx`, `EditUserModal.tsx`).
- **`PfpUpload` Component**:
  - Built shared profile photo uploader component with instant client preview.

### <img src="public/rina/excited.webp" width="08" align="center" /> ✦ Custom Hooks & Helper Modules

- **`useCountUp` Hook**: Extracted animated integer counter logic into `src/lib/useCountUp.ts`.
- **`useFileUpload` Hook**: Extracted FormData upload handling into `src/hooks/useFileUpload.ts`.
- **`pdf-palette.ts`**: Extracted PDF styling tokens and palettes into `src/lib/pdf-palette.ts`.

### <img src="public/rina/happy.webp" width="80" align="center" /> ✦ Shared Type System

- Centralized all shared data contracts into `src/types/index.ts` (`GoalData`, `DashboardGoal`, `SectionData`, `SectionDataFull`, `UserData`, `AdminUserData`, `FALLBACK_SECTIONS`).
- Replaced 8+ redundant inline interfaces across client pages with single `@/types` imports.

### <img src="public/rina/wave.webp" width="80" align="center" /> ✦ Accessibility & Motion

- Added `role="checkbox"` and `aria-checked` attributes to GoalCard step checklists.
- Added `prefers-reduced-motion` CSS media queries to `globals.css` to disable heavy animations for sensitive users.

---

## <img src="public/rina/update.webp" width="100" align="center" /> [0.2.0] — 2026-07-24 · *Profile System & Catarina Expression Overhaul*

> **Release Highlight:** Major feature release delivering user profile self-service editing, admin password management, context-aware Catarina pixel-art expressions, responsive layout polish, and full deployment documentation.

### <img src="public/rina/update.webp" width="80" align="center" /> ✦ Profile Customization & Admin Password Control

- **Self-Service Profile Editing (`PUT /api/auth/profile`)**:
  - Users can update display name, email, bio, password, and custom avatar image from Navbar profile dropdown. Password changes enforce current password verification.
- **Admin Password Reset (`PUT /api/admin/users/[userId]`)**:
  - Admin panel Edit User modal allows direct password resets without requiring current password verification.

### <img src="public/rina/celebration.webp" width="130" align="center" /> ✦ First-Time Welcome Celebration

- **`WelcomeModal` Component**:
  - Interactive welcome modal showing bouncing `celebration.webp` Catarina mascot, confetti particle physics, and quick onboarding tips. Persisted per user via `welcomeSeen` flag.

### <img src="public/rina/excited.webp" width="80" align="center" /> ✦ Context-Aware Catarina Expressions

Integrated 13 pixel-art expression stickers across application states:
- `logo.webp` — Main header emblem & favicon
- `happy.webp` — Welcome notifications & success toasts
- `wave.webp` — Welcome banner & introductory headers
- `thumb.webp` — Approval queue & deployment documentation
- `excited.webp` — Goal completion & member joined events
- `celebration.webp` — Month completion & welcome modal
- `bug-fix.webp` — Patch releases & bug fix badges
- `update.webp` — Realtime change notifications
- `think.webp` — Empty state illustrations
- `sleeping.webp` — Empty notification panel & footer logo
- `cry.webp` — Rejected signups & member left events
- `bye.webp` — Delete confirmation modals
- `404.webp` — Custom 404 error page

---

## <img src="public/rina/sleeping.webp" width="100" align="center" /> [0.1.5] — 2026-07-23 · *Stability & UX Polish*

### <img src="public/rina/bug-fix.webp" width="100" align="center" /> ✦ Improvements & Fixes

- **Pinned Welcome Audio Notification**: Ensured pinned "Why Catarina? 🌸" welcome message with `/media/fun.mp3` audio playback is delivered to all users upon seeding.
- **Registration PFP Upload**: Added optional profile picture upload during registration flow with automatic section fallback.
- **Custom 404 Error Page**: Created custom styled 404 page featuring `404.webp` sticker and quick navigation shortcuts.
- **Prisma 7 Compatibility**: Fixed driver adapter initialization with `@prisma/adapter-libsql` across all API handlers.

---

## <img src="public/rina/backup/sleepy.png" width="100" align="center" /> [0.1.0] — 2026-07-23 · *Initial Release*

> **Release Highlight:** First public release of Catarina — complete private team goal tracking platform backed by Turso DB, Prisma 7, and Next.js 16.

### <img src="public/rina/think.webp" width="80" align="center" /> ✦ Core Capabilities

- **Monthly Goal Boards**: Section-isolated goal boards with step checklists, progress targets, deadlines, and inline discussions.
- **Admin Control Panel**: Full member management, sign-up approval queue, section customization, and month creation/archiving.
- **Multi-Page PDF Report Export**: Dark-themed multi-page PDF generator complete with overview donut charts, goal status tables, and section completion bar charts.
- **Audio Notification System**: Integrated notification drawer supporting category filtering, pinning, unread counts, and audio playback.
- **Progressive Web App**: Service worker precaching, web manifest, and installability on desktop and mobile devices.

---

<div align="center">
  <sub>Catarina is maintained by <strong>Devora</strong> · &copy; Devora</sub>
</div>
