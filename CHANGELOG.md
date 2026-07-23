# Changelog

All notable changes to **Catarina** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- `meta.png` OpenGraph image for all social platforms
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
