# <img src="../public/rina/wave.webp" width="90" align="center" /> User Guide

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

## The Cabinet (`/tools`)

<img src="../public/rina/excited.webp" width="72" align="right" /> The navbar's **Cabinet** entry opens a hub of extra team tools. Today it holds **Drawers** and **Team Tables** — both live on the same permissions model as the rest of the app (admins always get full access).

### Drawers — the team workspace

Each section owns a **chest**; open it and every project pulls out like a drawer.

- **Chest → project → envelope/file** — projects hold *envelopes* (for the fiddly sub-things) and *loose files* (notes, links, code, images, videos) riding on top.
- **Everything syncs instantly** — the whole team sees the same drawer you just closed; there's no "save" button.
- **Add anything** — upload a file, paste a link, scratch a note. Large files are uploaded in chunks and reassembled automatically, so size isn't a worry.
- **Deletes are permanent** — removing a drawer, envelope, or file purges it for everyone with no undo.

### Team Tables — free-form grids

Every section can keep as many **tables** as it likes. Anyone with the **Manage Team Tables** permission (on by default) can create and edit them; admins always can, and everyone else views read-only.

- **Create a table** — from Cabinet → Table → create. It starts as a default 6×4 grid; name it and open it to edit.
- **Edit cells** — click into any cell and type. Enter commits and moves down, Tab moves right, Escape closes the cell.
- **Rows & columns** — add or delete rows/columns from the toolbar. Tap a cell edge to select a whole row/column; **hold or drag** an edge to resize it (double-click restores auto-size). Drag-select a rectangular region and hit **merge** to fuse cells; select a merged cell and hit **split** to break it apart.
- **Date mode** — toggle it on and Catarina looks for dates in the first row or first column; today's whole column (or row) lights up in the table's accent color.
- **Stickers** — open the sticker tray to drop Rina stickers anywhere on the grid. They dance; click to pause or tilt them, drag to reposition, and hover for lock/mirror/delete controls.
- **Export PDF** — pick dark or light, portrait or landscape (or let Catarina auto-fit the page), and optionally include stickers on the print.

> <img src="../public/rina/think.webp" width="44" align="center" /> **Note:** editing is limited to writers. A member without `canManageTables` sees tables read-only; admins are always writers.

## Habits that keep data safe

- Change the seeded admin password (`admin@team.com` / `admin123`) right after first login.
- Admins: assign members to sections before they can collaborate.
- Don't delete a month with goals you still need — deleted goals are gone (admins get a confirmation prompt).