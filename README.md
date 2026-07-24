<div>
  <img src="public/logo.webp" alt="Catarina Logo" width="140" />
  <h1>Catarina</h1>
  <p><strong>A private team planning & tracking system built for Devora.</strong></p>
  <p>
    <a href="https://catarina-devora.vercel.app"><img src="https://img.shields.io/badge/live-catarina--devora.vercel.app-00E8A2?style=flat-square" /></a>
    <img src="https://img.shields.io/badge/version-0.1.6-blue?style=flat-square" />
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" />
    <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma" />
    <img src="https://img.shields.io/badge/database-Turso-4FB8FF?style=flat-square" />
    <img src="https://img.shields.io/badge/PWA-ready-green?style=flat-square" />
  </p>
</div>

---

## ✦ What is Catarina?

**Catarina** is an internal planning and progress tracking application for the **Devora** creative team. It provides a structured, beautiful workspace where each team section — Marketing, Art, Technical, and Management — can own their goals, track progress, and collaborate within a unified monthly planning system.

Named after Omar's grandmother, Catarina embodies the values she passed down: quiet dedication, care for others, and the belief that showing up every day is what builds something truly great.

---

## ✦ Features

### 🗂 Multi-Section Goal Tracking
Each section has its own private space with goals, progress counters, step checklists, and comments. Sections are dynamic — admins can add, rename, recolor, or remove them from the Admin Panel. Members are scoped to their section(s), while admins have global visibility.

### 📅 Monthly Planning Cycles
Goals are organized by month. Admins can create new months, archive old ones, and generate beautiful PDF reports from the archive — complete with per-section breakdowns and a performance chart.

### 📊 Live Performance Dashboard
The main dashboard shows real-time stats: total goals, completed goals, remaining goals, and overall completion percentage — all with smooth count-up animations and section bar charts.

### 🔔 In-App Notifications
Rich notification system with pinning, marking as read, and audio playback support. 15+ notification types cover every team event — goal creation, step additions, member joins, deadline alerts, comments, role changes, and more.

### 🔐 Role-Based Access Control
Two roles: **Admin** (full control, member management, month creation) and **Member** (scoped to their section with fine-grained per-goal permissions). An approval flow gates new sign-ups.

### 🗳 Archive & PDF Export
Archived months are browsable, searchable by section, and fully exportable as a styled multi-page PDF — dark-themed, full-bleed, designed for documentation.

### 📱 Progressive Web App (PWA)
Installable on any device — Android, iOS, or desktop — directly from the browser. A service worker handles offline caching of core assets.

### 🌐 Edge-Ready with Turso
The database runs on [Turso](https://turso.tech) (libSQL), a globally distributed SQLite-compatible edge database, accessed via `@prisma/adapter-libsql` with Prisma 7.

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion 12 |
| Database ORM | Prisma 7 |
| Database | Turso (libSQL / SQLite) |
| Auth | JWT (jose) + bcrypt |
| Charts | Recharts |
| Notifications | Sonner |
| Icons | Lucide React |
| State | Zustand |
| PDF Export | Custom HTML/iframe renderer |
| PWA | Service Worker + Web Manifest |

---

## ✦ Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── [section]/       # Section goal pages (dynamic sections)
│   │   ├── admin/           # Admin panel (members, months, sections, permissions)
│   │   └── archive/         # Archived months + PDF export
│   └── api/                 # All REST API routes
├── components/
│   ├── ui/                  # Reusable primitives (Modal, CountUp, InView...)
│   ├── ColorPicker.tsx      # Premade + custom HSL color picker
│   ├── SectionManager.tsx   # Admin section CRUD UI
│   ├── Navbar.tsx
│   ├── SectionCard.tsx
│   ├── SectionChart.tsx
│   └── NotificationPanel.tsx
├── contexts/                # AuthContext, ThemeContext
└── lib/
    ├── prisma.ts            # Singleton Prisma client (Turso adapter)
    ├── auth.ts              # Session & token helpers
    ├── sections.ts          # Dynamic section loader with cache
    ├── notify.ts            # Notification helpers
    ├── permissions.ts       # Permission gate helpers
    └── utils.ts             # Section stats, color maps, etc.

prisma/
├── schema.prisma            # Database models (includes SectionConfig)
└── seed.ts                  # Seed script (users, goals, sections, notifications)

public/
├── logo.webp                # App logo (WebP, 18.7 KB)
├── icon-192.png             # PWA icon 192x192
├── icon-512.png             # PWA icon 512x512
├── apple-touch-icon.png     # Apple touch icon 180x180
├── rina/                    # Catarina expression images (WebP)
│   ├── happy.webp           # Welcome, success states
│   ├── 404.webp             # 404 page
│   ├── celebration.webp     # Full pose, milestones
│   └── ...                  # cry, excited, sleeping, think, thumb, wave
├── og-image.png             # OpenGraph image
├── fun.mp3                  # Welcome audio
└── manifest.json            # PWA manifest
```

---

## ✦ Getting Started

### Prerequisites
- Node.js 20+
- A [Turso](https://turso.tech) account and database

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your_auth_token"
JWT_SECRET="your_jwt_secret"
```

### 3. Push Schema & Seed

```bash
npm run db:seed
```

> **Note:** `prisma.config.ts` points the Prisma CLI to the local `dev.db` for schema management. The runtime app and seed script use Turso via the libSQL adapter.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@devora.com` | `admin123` |
| Member (Marketing) | `marketing@devora.com` | `member123` |
| Member (Art) | `art@devora.com` | `member123` |
| Member (Technical) | `technical@devora.com` | `member123` |
| Member (Management) | `management@devora.com` | `member123` |

---

## ✦ Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production bundle |
| `npm run db:seed` | Seed the database (Turso) with initial data |
| `npm run db:studio` | Open Prisma Studio (local SQLite) |

---

## ✦ Sections

Default sections (configurable by admins via Section Manager):

| Section | Color | Hex | Focus |
|---|---|---|---|
| 🔴 **Marketing** | Red / Pink | `#FF4D6A` | Brand identity, content planning, social strategy |
| 🟣 **Art** | Purple | `#7C3AED` | UI/UX design, graphic design, visual production |
| 🔵 **Technical** | Blue | `#3B82F6` | Development, system design, infrastructure |
| 🟡 **Management** | Amber / Gold | `#F59E0B` | Project coordination, client relations, team tracking |

> The app accent color is **Neon Teal** (`#00E8A2`) — used for interactive elements, borders, and the brand identity across all sections.

---

## ✦ License

Private — internal use by Devora team only.

---

<div align="center">
  <sub>Built with care by <strong>Omar Khaled</strong> for the Devora team · Named for <em>Catarina</em></sub>
</div>
