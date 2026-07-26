# <img src="public/rina/logo.webp" width="130" align="center" /> Catarina Changelog

All notable changes, release notes, and version history for **Catarina** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<br />

<div align="center">
  <img src="public/media/work.png" alt="Catarina Workspace Banner" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);" />
</div>

<br />

---

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

## <img src="public/rina/backup/sleepy.png.webp" width="100" align="center" /> [0.1.0] — 2026-07-23 · *Initial Release*

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
