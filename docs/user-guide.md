# User Guide

Catarina is your team's planning board. Each department (a **section**) has its own workspace
where goals are tracked month by month, with checklists, comments, and automatic notifications.

## Roles

| Role | Can do |
|---|---|
| **Member** | Work inside the sections they are assigned to: create/edit goals, update progress, comments, steps. |
| **Admin** | Everything above, plus: manage all sections and users, approve signups, promote/demote members, create/archive months, delete goals. |

## Logging in

1. Open the site URL.
2. If your admin already created your account, sign in with your email + password.
3. Otherwise click **Sign up**: pick your name, email, password, and the section you work in, then wait for admin approval. You can log in as soon as your request is approved.
4. First-time users see a welcome modal ("Why Catarina?") — click through to dismiss it. Fresh app versions show an update modal with the changelog.

## The dashboard

The dashboard (`/dashboard`) gives an overview of every section you can see:

- **Section cards** — colored cards with goal counts, completed counts, and a progress ring/bar.
- **Chart** — global overview of total / completed / remaining goals.
- **Month selector** — switch between planning months.

Click a section card to open that section's board (`/dashboard/[sectionKey]`).

## Working in a section

Each section shows its goals with a **target counter** and **progress indicator**.

- **Create a goal** — click *New Goal* +; goals auto-number with the section prefix (e.g. `MRK-001`).
- **Track progress** — edit the progress counter and target, or mark the goal done.
- **Steps** — add a checklist of sub-items; each step can be toggled.
- **Comments** — discuss the goal inline. Comments notify the section members and admins.
- **Deadline** — set a deadline (admins can lock it from editing by non-admins).
- **Assignments** — members can be assigned to a goal with *check* and *edit* permissions (admin-managed).
- **Pulse**: when another person's change arrives, the affected section card pulses briefly and new goals glow.

## Months & archive

- **New Month** (admin button) creates the next planning month and carries over unfinished goals (marked `Carried over`).
- Old months move to the **Archive** page (`/dashboard/archive`), browsable by month. Admins can delete a month from there.
- Each archived month has a **Report** page with tabs: *Overview*, *Sections*, *Performance* — and a **Download PDF** button (dark or light theme).

## Notifications

The bell icon in the navbar opens the notification drawer:

- **Mark read / Mark all read**, **Pin** important ones, **clear read** or **delete** individually.
- Some notifications carry a sound clip (inline audio player).
- `Month created` / `Goals carried over` notifications open a celebration modal.

## Profile

Open your avatar menu → **Profile** to change your **display name**, **email**, **bio**, **profile photo** (JPG/PNG/GIF/WebP, up to 2 MB), and **password**.

## Admin panel

Open your avatar menu → **Admin** (admins only):

- **Users** — list, create users directly, edit name/email/bio/photo, assign sections, set permissions, update role (promote/demote), delete users.
  - A member can't demote themselves, and the last admin can't be demoted.
  - Deleting a user who owns goals is blocked unless those goals are reassigned/deleted first (data-loss guard).
- **Approvals** — approve or reject pending signup requests.
- **Sections** — create/edit/drop sections (key, label, color, goal prefix). The prefix must look like `MRK-`.

## Habits that keep data safe

- Change the seeded admin password (`admin@team.com` / `admin123`) right after first login.
- Admins: assign members to sections before they can collaborate.
- Don't delete a month with goals you still need — deleted goals are gone (admins get a confirmation prompt).