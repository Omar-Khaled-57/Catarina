<div>
  <img src="public/rina/logo.webp" alt="Catarina Logo" width="160" />
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

## <img src="public/rina/wave.webp" width="36" align="center" /> What is Catarina?

**Catarina** is an internal planning and progress tracking app for small teams. Each team section has its own private space with goals, progress counters, step checklists, and comments. Sections are dynamic — admins can add, rename, recolor, or remove them from the Admin Panel. Members are scoped to their section(s), while admins have global visibility.

---

## <img src="public/rina/thumb.webp" width="36" align="center" /> Deploy Your Own

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
NEXT_PUBLIC_TEAM_NAME=Devora
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
TURSO_AUTH_TOKEN="your_turso_auth_token"
JWT_SECRET="any_random_string_here"
```

Set `NEXT_PUBLIC_TEAM_NAME` to your team name — it updates the footer, page titles, and PDF exports automatically.

### 4. Push Schema & Seed

```bash
npx prisma db push --env-file=.env
npm run db:seed
```

The first command pushes the database schema to your Turso database. The second creates the default admin account and sample data.

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

## <img src="public/rina/happy.webp" width="36" align="center" /> Default Admin Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@team.com` | `admin123` |

> **Change these immediately after first login.** Click your profile picture in the navbar to update your name, email, password, and profile photo.

---

## <img src="public/rina/excited.webp" width="36" align="center" /> Profile Customization

Every user can edit their own profile after login:

- **Name** — your display name
- **Email** — your login email
- **Password** — change with current password confirmation
- **Profile Photo** — upload JPG, PNG, GIF, or WebP (max 2 MB)
- **Bio** — short description shown on your profile

**How to access:**
- **Members:** Click your **profile picture** in the top-right navbar to open the Profile modal
- **Admins:** Can edit any member's full profile (including password reset) from the **Admin Panel** > click **Edit** on any user card

Each section also has default profile pictures (visible when no custom photo is uploaded):

| Section | Default PFP |
|---|---|
| Marketing | *None* (colored initial fallback) |
| Art | `public/pfps/art.png` |
| Technical | `public/pfps/tec.gif` |
| Management | `public/pfps/mng.gif` |

---

## <img src="public/rina/update.webp" width="36" align="center" /> Features

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

## <img src="public/rina/think.webp" width="36" align="center" /> Tech Stack

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

## <img src="public/rina/celebration.webp" width="36" align="center" /> Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production bundle |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Seed the database with default admin + sample data |
| `npm run db:reset` | Reset the database and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `postinstall` | Runs `prisma generate` after `npm install` |

---

## <img src="public/rina/bug-fix.webp" width="36" align="center" /> Sections

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
  <img src="public/rina/sleeping.webp" width="64" alt="Catarina sleeping" /><br/>
  <sub>Made with care for <strong>Devora</strong> · &copy; Devora</sub>
</div>

> **Note for clients:** Set `NEXT_PUBLIC_TEAM_NAME` in your `.env` to customize the team name throughout the app (footer, page titles, PDF exports).
