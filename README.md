<div align="center">
  <img src="public/media/banner.png" alt="Catarina Hero Banner" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);" />
</div>
<br />
<div>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma" alt="Prisma 7" />
    <img src="https://img.shields.io/badge/database-Turso-4FB8FF?style=flat-square" alt="Turso Database" />
    <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/version-0.4.3-blue?style=flat-square" alt="Version 0.4.3" />
    <img src="https://img.shields.io/badge/PWA-ready-green?style=flat-square" alt="PWA Ready" />
  </p>
</div>

## <img src="public/rina/update.webp" width="80" align="center" /> Latest release: 0.4.3

**Self-Hosting & Production Hardening** — Deploy your own Catarina with dynamic branding, production-grade rate limiting via Upstash Redis, proper Prisma migration workflow, and a complete self-hosting guide.

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## <img src="public/rina/wave.webp" width="100" align="center" /> What is Catarina?

**Catarina** is a private, multi-section team planning and progress tracking application built for agile design, engineering, marketing, and management teams. Each department gets its own dedicated workspace equipped with goal boards, interactive progress counters, sub-item checklists, and inline team discussions.

Administrators have global visibility across all sections, while members work within their assigned department spaces. Catarina features real-time synchronization, month-by-month planning cycles with multi-page PDF exports, custom profile avatars, audio-enabled notifications, and installable PWA capabilities.

<br />

<div align="center">
  <img src="public/media/work.png" alt="Catarina Workspace" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);" />
</div>

---

## <img src="public/rina/thumb.webp" width="100" align="center" /> Deploy Your Own Catarina

Follow this step-by-step guide to deploy your own instance of Catarina.

### Prerequisites

- **[Node.js](https://nodejs.org)**: v20.0.0 or higher
- **Package Manager**: `npm` (comes with Node.js)
- **Database**: A free account on [Turso](https://turso.tech) (libSQL / distributed SQLite edge database)
- **Deployment Platform** *(Optional)*: A free account on [Vercel](https://vercel.com)
- **Rate Limiting** *(Optional)*: A free account on [Upstash](https://upstash.com) for production rate limiting

---

### <img src="public/rina/happy.webp" width="60" align="center" /> Step 1: Clone & Install

Clone the repository to your local machine and install all dependencies:

```bash
git clone https://github.com/Omar-Khaled-57/Catarina.git
cd Catarina
npm install
```

---

### <img src="public/rina/note.webp" width="60" align="center" /> Step 2: Provision a [Turso](https://turso.tech) Database

1. Install the Turso CLI:
   - **macOS / Linux**: `curl -sSfL https://get.tur.so/install.sh | bash`
   - **Windows (PowerShell)**: `winget install tursodatabase.turso`
2. Authenticate with Turso:
   ```bash
   turso auth login
   ```
3. Create a new Turso database:
   ```bash
   turso db create catarina
   ```
4. Get your database URL and auth token:
   ```bash
   turso db show catarina --url
   turso db tokens create catarina
   ```

---

### <img src="public/rina/edit.webp" width="60" align="center" /> Step 3: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_TEAM_NAME` | Yes | Your team/org name (shown in nav, footers, PDFs) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your deployed URL (e.g. `https://catarina-yourteam.vercel.app`) |
| `DATABASE_URL` | Yes | Turso `libsql://` connection string |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `JWT_SECRET` | Yes | Random string for signing session tokens |
| `UPSTASH_REDIS_REST_URL` | No | [Upstash](https://upstash.com) Redis URL for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | [Upstash](https://upstash.com) Redis token |

---

### <img src="public/rina/excited.webp" width="60" align="center" /> Step 4: Push Schema & Seed Data

```bash
# Apply database migrations
npx prisma migrate deploy

# Seed default sections, admin user, and demo goals
npm run db:seed
```

This creates:
- 4 default sections (Marketing, Art, Technical, Management)
- 1 admin user (`admin@team.com` / `admin123`)
- Current month with 4 demo goals

> **First time?** You can also run `npm run db:setup` which does both steps above.

---

### <img src="public/rina/wave.webp" width="60" align="center" /> Step 5: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@team.com` | `admin123` |

> <img src="public/rina/excited.webp" width="50" align="center" /> **Important:** After logging in, change the default admin password from your profile settings.

---

### <img src="public/rina/thumb.webp" width="60" align="center" /> Step 6: Deploy to [Vercel](https://vercel.com)

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your Catarina repository.
4. In **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_TEAM_NAME`
   - `NEXT_PUBLIC_SITE_URL` (your Vercel domain)
   - `DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `JWT_SECRET`
   - *(Optional)* `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
5. In **Settings → General → Build Command**, set:
   ```
   npx prisma generate && npx prisma migrate deploy && next build
   ```
6. Click **Deploy**.

---

### <img src="public/rina/think.webp" width="60" align="center" /> Step 7: White-Labeling & Customization

- **Team Name**: Change `NEXT_PUBLIC_TEAM_NAME` to rebrand all headers, footers, page titles, and PDF exports.
- **Site URL**: Change `NEXT_PUBLIC_SITE_URL` to update SEO metadata, sitemap, and social preview links.
- **Sections**: Go to **Admin Panel → Section Manager** to add/remove/customize department sections.
- **Members**: Approve signups, assign members to sections, and manage permissions from the Admin Panel.

---

## <img src="public/rina/happy.webp" width="100" align="center" /> Default Credentials

| Role | Email | Password | Assigned Sections |
|---|---|---|---|
| **Admin** | `admin@team.com` | `admin123` | All Sections (Global Access) |

> After first login, create your own team members via the Admin Panel or have them sign up through the login page (requires admin approval).

---

## <img src="public/rina/excited.webp" width="100" align="center" /> Profile Customization

Every user can customize their personal profile from the Navbar modal:

- **Display Name** — Your public team display name
- **Email Address** — Account login email
- **Password Update** — Self-service password change
- **Profile Photo** — Upload custom avatars (JPG, PNG, GIF, WebP — max 2 MB)
- **Bio** — Personal role bio displayed in user cards

---

## <img src="public/rina/update.webp" width="100" align="center" /> Core Features

### ✦ Real-Time Collaboration & Sync
Changes made by team members sync automatically across active clients within 5 seconds. Includes optimistic UI updates, background delta fetching, and subtle shimmer animations on incoming changes.

### ✦ Multi-Section Goal Boards
Dynamic, customizable department sections. Goals support target counters, deadlines, lockable admin controls, member assignments, and step checklists.

### ✦ Monthly Planning & Archiving
Organize goal progress into monthly cycles. Past months can be archived and browsed anytime. Generate dark-themed PDF reports with overview charts and goal breakdowns.

### ✦ Interactive Performance Dashboard
Live telemetry showing total goals, completed count, remaining tasks, and global completion percentage with animated counters.

### ✦ Audio-Enabled Notification Center
In-app notification drawer with category tagging, pinning, read management, and inline audio playback.

### ✦ Installable Progressive Web App (PWA)
Built with an offline-capable Service Worker and Web Manifest — installable on iOS, Android, macOS, and Windows.

---

## <img src="public/rina/celebration.webp" width="100" align="center" /> Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js](https://nextjs.org) 16 (App Router) | Full-stack React framework |
| **Language** | [TypeScript](https://www.typescriptlang.org) 5.x | Type safety |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) 4.x | Utility-first CSS |
| **Database** | [Turso](https://turso.tech) (libSQL) | Distributed SQLite edge database |
| **ORM** | [Prisma](https://prisma.io) 7.x | Schema migrations & type-safe queries |
| **Auth** | [jose](https://github.com/panva/jose) + [bcryptjs](https://github.com/nicolo-ribaudo/bcryptjs) | Stateless sessions & hashed passwords |
| **Rate Limiting** | [Upstash Redis](https://upstash.com) | Serverless rate limiting (optional) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) 12.x | Route transitions & UI animations |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski/) 2.x | Toast notifications |
| **PWA** | Service Worker + Web Manifest | Offline support & installability |

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| **Development** | `npm run dev` | Start local dev server at `localhost:3000` |
| **Build** | `npm run build` | Production build |
| **Start** | `npm run start` | Start production server |
| **Lint** | `npm run lint` | Run ESLint |
| **Setup DB** | `npm run db:setup` | First-time: apply migrations + seed |
| **Seed DB** | `npm run db:seed` | Seed default sections, admin, and demo goals |
| **Reset DB** | `npm run db:reset` | Wipe database and re-seed from scratch |
| **Migrate** | `npm run db:migrate` | Create a new migration (dev only) |
| **Deploy Migrations** | `npm run db:deploy` | Apply pending migrations to production |
| **Migration Status** | `npm run db:status` | Show which migrations are pending |
| **Prisma Studio** | `npm run db:studio` | Open database browser |

---

## Default Sections

| Section | Key | Color | Prefix |
|---|---|---|---|
| **Marketing** | `MARKETING` | `#FF4D6A` | `MRK-` |
| **Art** | `ART` | `#7C3AED` | `ART-` |
| **Technical** | `TECHNICAL` | `#3B82F6` | `TEC-` |
| **Management** | `MANAGEMENT` | `#F59E0B` | `MNG-` |

Sections are fully customizable from the Admin Panel after deployment.

---

## License

Private repository — designed for internal team deployment.

---

<div align="center">
  <img src="public/rina/sleeping.webp" width="120" alt="Catarina Sleeping" /><br/>
  <sub>Made with care · &copy; Omar-Khaled-57</sub>
</div>
