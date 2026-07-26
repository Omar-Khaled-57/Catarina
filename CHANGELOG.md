# Changelog

All notable changes to **Catarina** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## <img src="public/rina/excited.webp" width="40" align="center" /> [0.4.0] — 2026-07-26 · *Realtime Sync — Live Collaboration*

> Minor release bringing real-time change detection, delta fetching, smart polling, and optimistic mutations. Changes from other users now appear within 5 seconds without page reload.

### <img src="public/rina/update.webp" width="32" align="center" /> ✦ Real-Time Change Detection

- **`GET /api/changes`** — Lightweight endpoint returning `MAX(updatedAt)` for goals, section config version, and new notification count (~3 row reads per call)
- **Delta fetching** — `?since=<ISO>` param on `GET /api/goals` and `GET /api/notifications` returns only modified items
- **Goal `updatedAt`** — Added to schema for change detection via Prisma's `@updatedAt`

### <img src="public/rina/excited.webp" width="32" align="center" /> ✦ Smart Polling

- **`usePolling` hook** — Adaptive interval: 5s (active), 15s (idle), 30s (hidden); immediate check on tab focus
- **`useRealtimeSync` hook** — Wraps polling + change detection + delta fetching; returns changed data for caller to merge
- **Visibility detection** — Pauses polling when tab is hidden, resumes on focus

### <img src="public/rina/happy.webp" width="32" align="center" /> ✦ Optimistic Mutations

- **Create goal** — Appears instantly with temp ID; replaced with real goal on success; rolled back on failure
- **Delete goal** — Removed immediately; restored on failure
- **Update goal** — Changes applied instantly; reverted on failure
- **Save assignments** — Updates applied instantly; reverted on failure

### <img src="public/rina/celebration.webp" width="32" align="center" /> ✦ UX Polish

- **GoalCard glow** — New goals from other users shimmer with a subtle teal glow animation (2s)
- **SectionCard pulse** — Dashboard section cards pulse when goals change in that section (3s)
- **Toast notifications** — Incoming changes trigger a brief toast in the navbar (rate-limited to 1 per 10s)

### <img src="public/rina/happy.webp" width="32" align="center" /> ✦ Performance & Caching

- **Static asset caching** — `/rina/`, `/pfps/`, `/fonts/` get infinite browser cache via `Cache-Control` headers
- **Service worker v3** — Precaches rina images + dashboard shell; network-first for dashboard pages; stale-while-revalidate for other pages
- **Navbar polling** — Smart polling via `usePolling` hook, reduced from 30s fixed to adaptive intervals

---

## <img src="public/rina/think.webp" width="40" align="center" /> [0.3.2] — 2026-07-25 · *Code Quality & Modularization*

> Patch release focused on component extraction, shared types, accessibility, and lint cleanup.

### <img src="public/rina/update.webp" width="32" align="center" /> ✦ Component Extraction

- **DonutChart** — SVG donut chart extracted from section page into `src/components/DonutChart.tsx`
- **SectionDetail** — Section detail view with donut stats and goal cards extracted from archive page into `src/components/SectionDetail.tsx`
- **EditUserModal / CreateUserModal** — Admin modals extracted from 660-line admin page into separate components (288 lines total)
- **PfpUpload** — Shared PFP upload preview component used by both admin modals

### <img src="public/rina/excited.webp" width="32" align="center" /> ✦ Custom Hooks & Shared Logic

- **useCountUp** — Animated count hook extracted to `src/lib/useCountUp.ts`
- **useFileUpload** — FormData upload hook extracted to `src/lib/useFileUpload.ts`
- **PDF_PALETTE** — PDF color palettes extracted to `src/lib/pdf-palette.ts` with `PdfTheme` type

### <img src="public/rina/happy.webp" width="32" align="center" /> ✦ Shared Type System

- **`src/types/index.ts`** — Centralized `GoalData`, `DashboardGoal`, `SectionData`, `SectionDataFull`, `UserData`, `AdminUserData`, `FALLBACK_SECTIONS`
- Eliminated 8+ duplicate type definitions across files; all pages import from `@/types`

### <img src="public/rina/wave.webp" width="32" align="center" /> ✦ Loading States

- Skeleton UI for dashboard, section, and admin pages while data loads

### <img src="public/rina/thumb.webp" width="32" align="center" /> ✦ Accessibility

- `role="checkbox"` + `aria-checked` on GoalCard and StepsChecklist checkboxes
- `prefers-reduced-motion` media query in `globals.css`

### <img src="public/rina/celebration.webp" width="32" align="center" /> ✦ Lint & Code Quality

- **39 → 1 lint problems** — unused imports, react-hooks rules, unescaped entities, no-img-element all resolved
- Remaining 1 issue: pre-existing `any` type in `dev/seed-sections.ts`
- **Math.random() replaced** — MonthCelebrationModal confetti uses deterministic PRNG for React purity
- **SEO sitemap** — `src/app/sitemap.ts` for public route indexing

---

## <img src="public/rina/celebration.webp" width="40" align="center" /> [0.2.0] — 2026-07-24 · *Profile System, Catarina Expressions & Release Polish*

> Major feature milestone — profile editing, character expressions, responsive UI overhaul, and release-ready code audit.

### <img src="public/rina/update.webp" width="32" align="center" /> ✦ New Features

- **Profile Editing (Self)** — Users can edit their own name, email, bio, profile picture, and password from the Navbar dropdown. Password change requires current password for security. Profile modal shows live preview of PFP and bio
- **Profile Editing (Admin)** — Admin panel Edit User modal now supports password reset (`newPassword` field) without requiring the current password. Admins can update any user's name, email, bio, PFP, and password
- **Welcome Celebration Modal** — First-time users see a full-screen celebration modal with bouncing `celebration.webp` Catarina image, confetti particles, and a "Start Exploring" button. Text mentions profile customization. Persisted via `welcomeSeen` boolean on User model to show only once
- **Login Rejection Feedback** — Login API detects rejected and pending approval accounts, returning specific error messages ("Your signup request was rejected by an admin." / "Your account is still pending admin approval.") instead of generic "Invalid credentials"
- **Comment Notifications** — Comments on goals now notify all section members + admins. The comment author is excluded from notifications. Uses new `COMMENT_ADDED` notification type with `MessageCircle` icon
- **Catarina Character Expressions** — Context-aware Catarina images placed throughout the app:
  - `think.webp` — Empty states (goals list, archive) at 120×120
  - `sleeping.webp` — Empty notification list at 96×96
  - `excited.webp` — Goal completion + member joined at 48×48
  - `thumb.webp` — Signup approval request at 48×48
  - `cry.webp` — Signup rejected + user left at 48×48
  - `bye.webp` — User deleted at 72×88 (half-body)
  - `wave.webp` — Available expression asset (not yet used in-app)
  - `happy.webp` — Welcome notification at 48×48
  - `celebration.webp` — Welcome modal + month celebration
  - `404.webp` — Custom 404 page at 280×280
- **Default Admin Credentials** — Seed changed to `admin@team.com` / `admin123` with `/pfps/mng.gif` PFP for easy first-time setup
- **Deploy-Your-Own README** — Complete rewrite with setup instructions, default credentials, profile customization docs, tech stack overview, and deployment guide

### <img src="public/rina/excited.webp" width="32" align="center" /> ✦ UI & Animation

- **Portrait/Responsive Layouts** — New Month, New User, and New Section buttons use compact stacked layout (`flex-col sm:flex-row`) with reduced padding on mobile. Admin page header stacks vertically on small screens
- **Scrollbar Hover Behavior** — Custom scrollbar thumb uses grey (`--text-muted`) by default, transitions to neon teal (`--accent`) only when cursor is near the scrollbar thumb area. Implemented via JS `onMouseMove` detection with `data-hover` attribute — `scrollbar-color` CSS property overridden in modern Chrome, so JS-based approach ensures cross-browser consistency
- **Donut Chart Animation** — Grey completion ring is now static (full circle, no animation). Colored progress ring always renders and animates from 0% to target via CSS transitions (1.2s cubic-bezier 0.22,1,0.36,1). Drop-shadow glow on colored ring
- **CountUp Animation Fix** — `useCountUp` hook fixed to always start from 0 (was starting from previous value on remount). Uses ease-out-expo easing for natural deceleration over 1000ms
- **Navbar Logo Shadow** — Removed oversized `shadow-[0_0_12px...]` from Navbar logo for cleaner appearance
- **Login Logo** — Removed `rounded-2xl shadow-2xl` from login page logo
- **SectionManager Modal** — Uses React Portal (`createPortal` to `document.body`) for true viewport centering, bypassing `backdrop-filter` ancestors that break `position:fixed`
- **Section Item Animation** — Removed `layout` prop and `AnimatePresence mode="popLayout"` from section list items; replaced with simple `opacity + y` fade-in for smoother transitions
- **Mobile Navbar** — Simplified to single-layer design with tighter easing curves and faster stagger timing
- **Version Badge** — Teal-accented version badge in Footer (`v0.2.0`, `text-accent bg-accent/10 border-accent/20`)

### <img src="public/rina/bug-fix.webp" width="32" align="center" /> ✦ Bug Fixes

- **CSS `borderColor` Conflict** — Loading spinner mixed shorthand `borderColor` with longhand `borderTopColor`; replaced with all longhand properties for consistent rendering
- **SectionChart Light Theme** — Replaced hardcoded `rgba(255,255,255,...)` colors with CSS variable-based `var(--border)` and `var(--text-muted)` for proper light theme support
- **Duplicate CSS Rule** — Removed duplicate `.in-view-visible` declaration in `globals.css`
- **Hardcoded Colors** — Dashboard page "Done" stat replaced inline `style={{ color: "#00E8A2" }}` with Tailwind `text-accent`, `bg-accent/10`, `border-accent/20` classes
- **Missing Asset Reference** — Removed non-existent `/pfps/mrk.gif` from `SECTION_PFP` map

### <img src="public/rina/think.webp" width="32" align="center" /> ✦ Code Quality Audit

- **JSDoc Headers** — Added missing `/** */` comment headers to `not-found.tsx`, `ServiceWorkerRegister.tsx`
- **Comment Style Consistency** — Converted `//` comment headers to `/** */` JSDoc format in `lib/utils.ts`, `lib/auth.server.ts`, `lib/permissions.ts`
- **SectionManager Overflow** — Changed admin page container from `overflow-hidden` to `overflow-visible` with `transition-all duration-300`; removed gradient bar that clipped content

### <img src="public/rina/wave.webp" width="32" align="center" /> ✦ New Files

- `src/components/WelcomeModal.tsx` — First-time welcome celebration modal
- `README.md` — Complete deploy-your-own documentation

### <img src="public/rina/thumb.webp" width="32" align="center" /> ✦ New API Routes

- `PUT /api/auth/profile` — Self-service profile editing (name, email, bio, PFP, password)
- `PUT /api/admin/users/[userId]` — Admin user editing with optional password reset
- `POST /api/auth/welcome-seen` — Marks welcome modal as seen

### <img src="public/rina/happy.webp" width="32" align="center" /> ✦ Infrastructure

- **Database** — Added `welcomeSeen Boolean @default(false)` to User model (schema + Turso)
- **Image Optimization** — All Catarina expression images optimized to WebP format (84% payload reduction)
- **PWA** — Service worker upgraded to v2 with stale-while-revalidate caching

---

## <img src="public/rina/sleeping.webp" width="40" align="center" /> [0.1.5] — 2026-07-23 · *Stability & UX Polish*

### <img src="public/rina/bug-fix.webp" width="32" align="center" /> ✦ Bug Fixes & Improvements

- **Welcome Notification** — Hardcoded "Why Catarina? 🌸" pinned notification now ensured for ALL users (including admins) on every `/api/auth/me` call until they mark it read or delete it
- **Register Flow** — Added optional profile picture upload during registration; falls back to section-colored default PFP from `/pfps/` if no image provided
- **Approval Flow** — New users created from approvals now receive the correct default PFP based on their assigned section
- **Custom 404 Page** — Replaced Next.js default 404 with stylized page using `/rina/404.webp` and navigation buttons
- **Routing** — Invalid section slugs on `/dashboard/[section]` now redirect client-side to `/dashboard` instead of causing runtime errors
- **PWA** — Manifest name and short_name set to "Catarina"; service worker upgraded to v2 with stale-while-revalidate caching
- **SEO & Accessibility** — Added `robots.ts`, skip-to-content link, improved label associations, focus trap in modals, and ARIA attributes on custom dropdown
- **Build Fixes** — Resolved Prisma 7 type inference issues across all API routes; added `postinstall` script for Prisma client generation; fixed Vercel deployment build failures

### ✦ Infrastructure

- **Version bump** — 0.1.0 → 0.1.5
- **Database** — Added `pfp` field to `Approval` model for registration photo uploads

---

## <img src="public/rina/sleeping.webp" width="40" align="center" /> [0.1.0] — 2026-07-23 · *Initial Release*

> The first complete version of Catarina, live on Turso with full team functionality.

### <img src="public/rina/think.webp" width="32" align="center" /> ✦ Core System

- **Monthly Planning** — Goal organization by month with admin-controlled month lifecycle (create, archive, delete mock months)
- **Section Architecture** — Four isolated sections: Marketing, Art, Technical, Management — each with their own goal boards, members, and performance metrics
- **Role-Based Access** — Admin and Member roles with fine-grained per-goal permissions (`canCheck`, `canEdit`); admins see everything, members see their sections
- **Sign-up Approval Flow** — New member registrations require admin approval before access is granted

### <img src="public/rina/update.webp" width="32" align="center" /> ✦ Goals

- Create, edit, and delete goals with name, description, progress counter (`current`/`target`), deadline, and section
- Admin-only deadline management with a toggle to lock deadlines from member editing
- Per-goal step checklists (subtasks) with drag-free ordered completion
- Per-goal comments thread for inline team discussion
- Goal assignment: assign specific members to goals with per-member permission overrides
- Carried-over goal tracking for goals that span months

### <img src="public/rina/happy.webp" width="32" align="center" /> ✦ Dashboard

- Overview of all 4 sections in a responsive 2-column card grid
- Global stats bar: Total Goals, Done, Remaining, Completion % — all with count-up animations on scroll
- Section performance bar chart showing completion % per section
- Month selector for switching between active and archived months

### <img src="public/rina/wave.webp" width="32" align="center" /> ✦ Archive & PDF Export

- Archived months browsable with full goal history per section
- Multi-page full-bleed PDF export per archived month — dark-themed, no white borders
  - Page 1: Overview stats + donut chart
  - Pages 2–5: Per-section goal tables with status chips
  - Page 6: Section completion bar chart

### <img src="public/rina/excited.webp" width="32" align="center" /> ✦ Notifications

- In-app notification panel with unread count badge in Navbar
- Notification types: `GOAL_CREATED`, `STEP_ADDED`, `MEMBER_JOINED`, `SIGNUP_REQUEST`, `DEADLINE_APPROACHING`, `DEADLINE_MISSED`, `GOAL_COMPLETED`, `SYSTEM`, `GOAL_REACHED`, `COMMENT_ADDED`, `MEMBER_LEFT_SECTION`, `MEMBER_DELETED`, `MONTH_CREATED`, `GOALS_CARRIED_OVER`, `ROLE_CHANGED`, `VERSION_UPDATE`
- Per-notification: mark read, pin, delete; bulk: mark all read, clear read
- **Audio notifications** — notifications with `refType: "audio"` render an inline Play/Pause button
- Pinned "Why Catarina? 🌸" welcome notification with `fun.mp3` playback sent to all users on seed

### <img src="public/rina/thumb.webp" width="32" align="center" /> ✦ Admin Panel

- Member management: view all members, edit permissions, delete members
- Month management: create months, archive months, delete mock/test months (admin-only)
- Approval queue: review and approve/reject pending sign-up requests
- Section assignment: add or remove members from sections

### <img src="public/rina/celebration.webp" width="32" align="center" /> ✦ UI & Design

- Dark-mode-first design system with CSS custom properties
- Glassmorphism card surfaces (`glass` utility class)
- Section accent colors: Marketing (`#FF4D6A` red-pink), Art (`#7C3AED` purple), Technical (`#3B82F6` blue), Management (`#F59E0B` amber) — with a global Neon Teal (`#00E8A2`) app accent
- Smooth Framer Motion transitions on route changes and list mutations
- `InView` scroll-triggered reveal animations on dashboard cards and stats
- `CountUp` animated number counters on stats
- Smooth sort/search filter transitions in section goal lists
- Border ring indicator on active section dots in archive report

### <img src="public/rina/think.webp" width="32" align="center" /> ✦ PWA & SEO

- Full Progressive Web App support: Web App Manifest, Service Worker, installable on Android/iOS/desktop
- `logo.png` used as favicon, apple touch icon, and PWA icon
- `og-image.png` OpenGraph image for all social platforms
- Full SEO metadata: title tags, meta descriptions, Open Graph, Twitter Card
- Next.js `<Image />` optimization on all logo/avatar images

### ✦ Infrastructure

- **Database**: [Turso](https://turso.tech) (libSQL edge database, globally distributed)
- **ORM**: Prisma 7 with `@prisma/adapter-libsql` driver adapter
- **Auth**: Stateless JWT sessions via `jose`, passwords hashed with `bcryptjs`
- **Framework**: Next.js 16 App Router (TypeScript, Tailwind CSS 4)
- `prisma.config.ts` separates CLI datasource (local `file:./dev.db`) from runtime adapter (Turso)

---

<sub>Catarina is a private internal tool for the Devora team.</sub>
