<div>
  <img src="public/logo.webp" alt="Catarina Logo" width="140" />
  <h1>Catarina</h1>
  <p><strong>A private team planning & tracking system.</strong></p>
  <p>
    <a href="https://catarina-devora.vercel.app"><img src="https://img.shields.io/badge/live-catarina--devora.vercel.app-00E8A2?style=flat-square" /></a>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" />
    <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma" />
    <img src="https://img.shields.io/badge/database-Turso-4FB8FF?style=flat-square" />
    <img src="https://img.shields.io/badge/PWA-ready-green?style=flat-square" />
  </p>
</div>

---

## What is Catarina?

**Catarina** is an internal planning and progress tracking app for small teams. Each team section has its own private space with goals, progress counters, step checklists, and comments. Sections are dynamic — admins can add, rename, recolor, or remove them from the Admin Panel. Members are scoped to their section(s), while admins have global visibility.

---

## Deploy Your Own

### Prerequisites
- Node.js 20+
- A [Turso](https://turso.tech) account and database (free tier works)

### 1. Fork & Install

```bash
git clone https://github.com/YOUR_USERNAME/Catarina.git
cd Catarina
npm install
```

### 2. Create a Turso Database

```bash
npx turso auth login
npx turso db create catarina
npx turso db tokens create catarina
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
TURSO_AUTH_TOKEN="your_turso_auth_token"
JWT_SECRET="any_random_string_here"
```

### 4. Seed the Database

```bash
npm run db:seed
```

This creates the default admin account and sample data in your Turso database.

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel (Optional)

```bash
npx vercel --prod
```

Set the same three environment variables in the Vercel dashboard under **Settings > Environment Variables**.

---

## Default Admin Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@team.com` | `admin123` |

> **Change these immediately after first login.** Click your profile picture in the navbar to update your name, email, password, and profile photo.

---

## Profile Customization

Every user can edit their own profile after login:

- **Name** — your display name
- **Email** — your login email
- **Password** — change with current password confirmation
- **Profile Photo** — upload JPG, PNG, GIF, or WebP (max 5 MB)
- **Bio** — short description shown on your profile

**How to access:**
- **Members:** Click your **profile picture** in the top-right navbar to open the Profile modal
- **Admins:** Can edit any member's full profile (including password reset) from the **Admin Panel** > click **Edit** on any user card

Each section also has default profile pictures (visible when no custom photo is uploaded):

| Section | Default PFP |
|---|---|
| Marketing | `public/pfps/mrk.gif` |
| Art | `public/pfps/art.png` |
| Technical | `public/pfps/tec.gif` |
| Management | `public/pfps/mng.gif` |

---

## Features

### Multi-Section Goal Tracking
Each section has its own private space with goals, progress counters, step checklists, and comments. Sections are dynamic — admins can add, rename, recolor, or remove them from the Admin Panel.

### Monthly Planning Cycles
Goals are organized by month. Admins can create new months, archive old ones, and generate PDF reports from the archive — complete with per-section breakdowns and a performance chart.

### Live Performance Dashboard
Real-time stats: total goals, completed goals, remaining goals, and overall completion percentage with count-up animations and section bar charts.

### In-App Notifications
Rich notification system with pinning, marking as read, and audio playback. 15+ notification types cover every team event.

### Role-Based Access Control
Two roles: **Admin** (full control, member management, month creation) and **Member** (scoped to their section with per-goal permissions). An approval flow gates new sign-ups.

### Archive & PDF Export
Archived months are browsable, searchable, and fully exportable as styled multi-page PDFs.

### Progressive Web App (PWA)
Installable on any device — Android, iOS, or desktop — directly from the browser.

---

## Tech Stack

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
| PWA | Service Worker + Web Manifest |

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production bundle |
| `npm run db:seed` | Seed the database with default admin + sample data |
| `npm run db:reset` | Reset the database and re-seed |
| `npm run db:studio` | Open Prisma Studio (local SQLite only) |

---

## Sections

Default sections (configurable by admins via Section Manager):

| Section | Color | Hex | Focus |
|---|---|---|---|
| Marketing | Red / Pink | `#FF4D6A` | Brand identity, content planning, social strategy |
| Art | Purple | `#7C3AED` | UI/UX design, graphic design, visual production |
| Technical | Blue | `#3B82F6` | Development, system design, infrastructure |
| Management | Amber / Gold | `#F59E0B` | Project coordination, client relations, team tracking |

The app accent color is **Neon Teal** (`#00E8A2`).

---

## License

Private — internal use only.

---

<div align="center">
  <sub>Built with care by <strong>Omar Khaled</strong> · Named for <em>Catarina</em></sub>
</div>
