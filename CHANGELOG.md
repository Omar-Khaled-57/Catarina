# Changelog

All notable changes to **Catarina** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.5] — 2026-07-23 · *Stability & UX Polish*

### ✦ Bug Fixes & Improvements

- **Welcome Notification** — Hardcoded "Why Catarina? 🌸" pinned notification now ensured for ALL users (including admins) on every `/api/auth/me` call until they mark it read or delete it
- **Register Flow** — Added optional profile picture upload during registration; falls back to section-colored default PFP from `/pfps/` if no image provided
- **Approval Flow** — New users created from approvals now receive the correct default PFP based on their assigned section
- **Custom 404 Page** — Replaced Next.js default 404 with stylized page using `/rina/404.png` and navigation buttons
- **Routing** — Invalid section slugs on `/dashboard/[section]` now redirect client-side to `/dashboard` instead of causing runtime errors
- **PWA** — Manifest name and short_name set to "Catarina"; service worker upgraded to v2 with stale-while-revalidate caching
- **SEO & Accessibility** — Added `robots.ts`, skip-to-content link, improved label associations, focus trap in modals, and ARIA attributes on custom dropdown
- **Build Fixes** — Resolved Prisma 7 type inference issues across all API routes; added `postinstall` script for Prisma client generation; fixed Vercel deployment build failures

### ✦ Infrastructure

- **Version bump** — 0.1.0 → 0.1.5
- **Database** — Added `pfp` field to `Approval` model for registration photo uploads

---

## [0.1.7] — 2026-07-24 · *UI Overhaul, Footer & Audit Fixes*

### ✦ New Features

- **Mobile Navigation** — Added hamburger menu on mobile with animated dropdown (framer-motion). Full menu with user info, nav links, notifications, profile, and logout. Matches hodor reference design
- **Footer** — New app footer with logo, navigation links, and branding
- **Admin Section API** — Added `GET /api/admin/sections` endpoint for listing all sections including inactive ones

### ✦ Bug Fixes & Improvements

- **SectionManager** — Fixed fetching from non-existent admin endpoint; now properly uses `GET /api/admin/sections`
- **Login Page** — Replaced 12 hardcoded `SECTIONS`/`SECTION_COLORS`/`SECTION_LABELS` references with dynamic section data fetched from API
- **Navbar** — Removed hardcoded section imports; profile modal now fetches dynamic section labels and colors from API
- **GoalRow** — Removed dead `SECTION_COLORS` import (component only exported types, never rendered)
- **GoalCard** — Replaced hardcoded `SECTION_PREFIX` map with dynamic `sectionPrefixes` prop (falls back to first 3 letters of section key)

### ✦ Audit Fixes

- Eliminated all remaining hardcoded section constants from client components
- All section data now flows through the dynamic `GET /api/sections` endpoint with fallback defaults
- Added `Footer` to dashboard layout
- Mobile navbar now shows active state indicators (dot + accent underline)

### ✦ New Features

- **Dynamic Sections** — Replaced hardcoded `SECTIONS` constant with database-backed `SectionConfig` model. Admins can now add, edit, rename, recolor, and soft-delete sections from the Admin Panel via a new Section Manager UI
- **Color Picker** — New `ColorPicker` component with 8 premade colors and a custom HSL picker. Up to 10 custom colors saved to localStorage
- **Section Prefixes** — Each section now has a configurable prefix (e.g. `MRK-`, `ART-`) stored in `SectionConfig` for future goal numbering
- **Expanded Notifications** — 7 new notification types: `SIGNUP_REJECTED`, `GOAL_REACHED`, `COMMENT_ADDED`, `MEMBER_LEFT_SECTION`, `MEMBER_DELETED`, `MONTH_CREATED`, `GOALS_CARRIED_OVER`, `ROLE_CHANGED`. Wired into approvals, promotions, comments, goal toggles, month creation, and user management API routes
- **Strict Routing** — Invalid section slugs and deleted archive months now render a proper 404 page with context-aware messaging instead of silent redirects
- **Image Optimization** — All Rina expression images and logo resized to optimal WebP dimensions. Total image payload reduced from 1.17 MB to 183 KB (84% reduction)

### ✦ Bug Fixes & Improvements

- **PWA Name** — Installed app name now shows only "Catarina" on all platforms (was "Catarina — Devora Team Planner" on Android). Manifest and all metadata sources unified
- **PWA Icons** — Generated properly-sized icons (192x192, 512x512, apple-touch-icon 180x180) from the WebP logo instead of serving a 1 MB PNG
- **404 Page** — Enhanced with `usePathname()` to show context-specific messages for section vs archive vs generic routes
- **Archive Month Validation** — Invalid `monthId` in URL now calls `notFound()` instead of rendering a blank page
- **Section Card & Chart** — Components now accept dynamic `color` and `label` props instead of relying on hardcoded constants

### ✦ New Files

- `src/lib/sections.ts` — Dynamic section loader with 30-second cache and hardcoded fallback
- `src/components/ColorPicker.tsx` — Premade + custom color picker
- `src/components/SectionManager.tsx` — Admin section CRUD UI
- `src/app/api/sections/route.ts` — Public sections endpoint
- `src/app/api/admin/sections/route.ts` — Admin create section
- `src/app/api/admin/sections/[id]/route.ts` — Admin update/delete section

### ✦ Infrastructure

- **Database** — Added `SectionConfig` model with `key`, `label`, `prefix`, `color`, `sortOrder`, `isActive` fields
- **Seed** — Updated `prisma/seed.ts` to create default sections and `SectionConfig` records

---

## [Unreleased] — 2026-07-23 · *In Progress*

> Preliminary fix for corrupted `GoalForm.tsx` — full patch still required.

### ✦ Bug Fixes

- **GoalForm** — Initial recovery patch applied to restore component integrity after corruption. Form state, assignment picker, and modal structure have been stabilized. Further refactoring and validation still needed.

---

## [0.1.0] — 2026-07-23 · *Initial Release*

> The first complete version of Catarina, live on Turso with full team functionality.

### ✦ Core System

- **Monthly Planning** — Goal organization by month with admin-controlled month lifecycle (create, archive, delete mock months)
- **Section Architecture** — Four isolated sections: Marketing, Art, Technical, Management — each with their own goal boards, members, and performance metrics
- **Role-Based Access** — Admin and Member roles with fine-grained per-goal permissions (`canCheck`, `canEdit`); admins see everything, members see their sections
- **Sign-up Approval Flow** — New member registrations require admin approval before access is granted

### ✦ Goals

- Create, edit, and delete goals with name, description, progress counter (`current`/`target`), deadline, and section
- Admin-only deadline management with a toggle to lock deadlines from member editing
- Per-goal step checklists (subtasks) with drag-free ordered completion
- Per-goal comments thread for inline team discussion
- Goal assignment: assign specific members to goals with per-member permission overrides
- Carried-over goal tracking for goals that span months

### ✦ Dashboard

- Overview of all 4 sections in a responsive 2-column card grid
- Global stats bar: Total Goals, Done, Remaining, Completion % — all with count-up animations on scroll
- Section performance bar chart showing completion % per section
- Month selector for switching between active and archived months

### ✦ Archive & PDF Export

- Archived months browsable with full goal history per section
- Multi-page full-bleed PDF export per archived month — dark-themed, no white borders
  - Page 1: Overview stats + donut chart
  - Pages 2–5: Per-section goal tables with status chips
  - Page 6: Section completion bar chart

### ✦ Notifications

- In-app notification panel with unread count badge in Navbar
- Notification types: `GOAL_CREATED`, `STEP_ADDED`, `MEMBER_JOINED`, `SIGNUP_REQUEST`, `DEADLINE_APPROACHING`, `DEADLINE_MISSED`, `GOAL_COMPLETED`, `SYSTEM`
- Per-notification: mark read, pin, delete; bulk: mark all read, clear read
- **Audio notifications** — notifications with `refType: "audio"` render an inline Play/Pause button
- Pinned "Why Catarina? 🌸" welcome notification with `fun.mp3` playback sent to all users on seed

### ✦ Admin Panel

- Member management: view all members, edit permissions, delete members
- Month management: create months, archive months, delete mock/test months (admin-only)
- Approval queue: review and approve/reject pending sign-up requests
- Section assignment: add or remove members from sections

### ✦ UI & Design

- Dark-mode-first design system with CSS custom properties
- Glassmorphism card surfaces (`glass` utility class)
- Section accent colors: Marketing (`#FF4D6A` red-pink), Art (`#7C3AED` purple), Technical (`#3B82F6` blue), Management (`#F59E0B` amber) — with a global Neon Teal (`#00E8A2`) app accent
- Smooth Framer Motion transitions on route changes and list mutations
- `InView` scroll-triggered reveal animations on dashboard cards and stats
- `CountUp` animated number counters on stats
- Smooth sort/search filter transitions in section goal lists
- Border ring indicator on active section dots in archive report

### ✦ PWA & SEO

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
