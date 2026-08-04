# <img src="public/rina/logo.webp" width="130" align="center" /> Catarina Changelog

All notable changes, release notes, and version history for **Catarina** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<br />

<div align="center">
  <img src="public/media/work.png" alt="Catarina Workspace Banner" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);" />
</div>

<br />

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
- **`useFileUpload` Hook**: Extracted FormData upload handling into `src/lib/useFileUpload.ts`.
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
