/**
 * prisma/seed-tables.ts — replace the demo TeamTables with a richer showcase.
 *
 * Hard-deletes every existing table, then inserts a set of polished demo grids
 * that exercise the TeamTable features people actually meet on /tools/tables:
 *   • date mode with the TODAY strip ("Launch Week Calendar", "Sprint Velocity")
 *   • merged regions ("Sprint Timeline", "Campaign Launch Checklist",
 *     "Art Asset Board", "Team Budget Tracker")
 *   • pre-sized rows/columns and floating Rina stickers
 *
 * Run with: npm run db:seed-tables   (writes straight to Turso via its HTTP API)
 */

import { existsSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";

/* ─── Grid builder ───────────────────────────────────────────────────────── */

type Cell = { v: string; rs: number; cs: number } | null;
interface Grid {
  rows: Cell[][];
  cols: number;
  sizes: { rows: number[]; cols: number[] };
}

function emptyCell(): NonNullable<Cell> {
  return { v: "", rs: 1, cs: 1 };
}

function makeGrid(cols: number, rowCount: number): Grid {
  return {
    rows: Array.from({ length: rowCount }, () =>
      Array.from({ length: cols }, emptyCell),
    ),
    cols,
    sizes: {
      rows: Array.from({ length: rowCount }, () => 52),
      cols: Array.from({ length: cols }, () => 120),
    },
  };
}

/** Place a value; positions covered by the span become `null`. */
function set(
  g: Grid,
  r: number,
  c: number,
  v: string,
  rs = 1,
  cs = 1,
): void {
  const rows = g.rows;
  rows[r][c] = { v, rs, cs };
  for (let rr = r; rr < r + rs; rr++) {
    for (let cc = c; cc < c + cs; cc++) {
      if (rr === r && cc === c) continue;
      rows[rr][cc] = null;
    }
  }
}

function fillRow(g: Grid, r: number, values: string[]): void {
  for (let i = 0; i < values.length; i++) set(g, r, i, values[i], 1, 1);
}

/* ─── The tables ─────────────────────────────────────────────────────────── */

interface SeedTable {
  section: string;
  name: string;
  color: string;
  isDateBased: boolean;
  grid: Grid;
  stickers: Record<string, unknown>[];
}

function buildTables(): SeedTable[] {
  const tables: SeedTable[] = [];

  /* 1 --------------------------------------------------- Launch Week Calendar
     Date mode, column axis → today's column lights up (2026-09-22). */
  {
    const g = makeGrid(8, 11);
    g.sizes.cols = [88, 230, 104, 104, 104, 104, 104, 104];
    g.sizes.rows = [48, 54, 54, 54, 54, 54, 54, 54, 54, 54, 62];
    // header
    fillRow(g, 0, [
      "Owner", "Deliverable",
      "2026-09-21", "2026-09-22", "2026-09-23",
      "2026-09-24", "2026-09-25", "2026-09-26",
    ]);
    // Sara (rows 1–3)
    set(g, 1, 0, "Sara", 3, 1);
    fillRow(g, 1, ["", "Moodboard + concept", "✅", "🎨 palette", "", "", "", ""]);
    fillRow(g, 2, ["", "Script + shot list", "", "", "📝", "✅", "", ""]);
    fillRow(g, 3, ["", "Voiceover record", "", "", "", "", "🎙️", "✅"]);
    // Omar (rows 4–6)
    set(g, 4, 0, "Omar", 3, 1);
    fillRow(g, 4, ["", "Design frames", "", "", "", "🎨", "🎨", "✅"]);
    fillRow(g, 5, ["", "Animation pass", "", "", "", "", "🎬", "🎬"]);
    fillRow(g, 6, ["", "Motion tests", "", "", "", "", "", "🔬"]);
    // Lina (rows 7–9)
    set(g, 7, 0, "Lina", 3, 1);
    fillRow(g, 7, ["", "Sound design", "🎧", "", "🎧", "", "", ""]);
    fillRow(g, 8, ["", "Colour grade", "", "", "", "", "🎨", "✅"]);
    fillRow(g, 9, ["", "Final delivery", "", "", "", "", "", "🚀"]);
    // footer band (row 10)
    set(g, 10, 0, "🎉 Launch week loop is ready for the whole team", 1, 8);

    tables.push({
      section: "MARKETING",
      name: "Launch Week Calendar",
      color: "#FF4D6A",
      isDateBased: true,
      grid: g,
      stickers: [
        { id: "t1-excited", sprite: "excited", x: 76, y: 16, w: 118, locked: false, mirrored: true, state: "play" },
        { id: "t1-wave", sprite: "wave", x: 18, y: 82, w: 104, locked: false, mirrored: false, state: "play" },
      ],
    });
  }

  /* 2 --------------------------------------------------- Sprint Timeline
     Merged milestone bands down the first column. */
  {
    const g = makeGrid(5, 13);
    g.sizes.cols = [150, 120, 110, 150, 250];
    g.sizes.rows = [48, 54, 54, 54, 54, 54, 54, 54, 54, 54, 54, 54, 62];
    fillRow(g, 0, ["Milestone", "Due", "Owner", "Status", "Note"]);
    // Kickoff
    set(g, 1, 0, "Kickoff", 2, 1);
    fillRow(g, 1, ["", "2026-09-18", "Amr", "✅ done", "Team aligned on goals"]);
    fillRow(g, 2, ["", "2026-09-20", "Amr", "✅ done", "Repo + kanban set up"]);
    // Build
    set(g, 3, 0, "Build", 4, 1);
    fillRow(g, 3, ["", "2026-09-21", "Sara", "🔥 in progress", "Wireframes ready"]);
    fillRow(g, 4, ["", "2026-09-24", "Sara", "in progress", "UI kit mid pass"]);
    fillRow(g, 5, ["", "2026-09-26", "Omar", "todo", "Prototype interactions"]);
    fillRow(g, 6, ["", "2026-09-28", "Lina", "todo", "Motion examples"]);
    // Test
    set(g, 7, 0, "Test", 3, 1);
    fillRow(g, 7, ["", "2026-09-29", "team", "todo", "QA pass"]);
    fillRow(g, 8, ["", "2026-10-01", "team", "todo", "Bug triage"]);
    fillRow(g, 9, ["", "2026-10-02", "team", "todo", "Perf pass"]);
    // Ship
    set(g, 10, 0, "Ship", 2, 1);
    fillRow(g, 10, ["", "2026-10-05", "Amr", "todo", "Release cut"]);
    fillRow(g, 11, ["", "2026-10-06", "Amr", "todo", "Handoff deck"]);
    set(g, 12, 0, "🚀 Target ship date: Oct 6 — invite the whole team", 1, 5);

    tables.push({
      section: "MARKETING",
      name: "Sprint Timeline",
      color: "#7C3AED",
      isDateBased: false,
      grid: g,
      stickers: [
        { id: "t2-thumb", sprite: "thumb", x: 80, y: 20, w: 110, locked: false, mirrored: false, state: "play" },
      ],
    });
  }

  /* 3 --------------------------------------------------- Campaign Launch Checklist
     Merged phase column, classic checklist rows. */
  {
    const g = makeGrid(4, 15);
    g.sizes.cols = [160, 280, 130, 140];
    g.sizes.rows = [46, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52];
    fillRow(g, 0, ["Phase", "Task", "Owner", "Status"]);
    set(g, 1, 0, "Pre-Launch", 6, 1);
    fillRow(g, 1, ["", "Buy the domain", "Marketing", "✅"]);
    fillRow(g, 2, ["", "Set up the team workspace", "Marketing", "✅"]);
    fillRow(g, 3, ["", "Finalise brand kit", "Art", "✅"]);
    fillRow(g, 4, ["", "Write launch copy", "Content", "🔄"]);
    fillRow(g, 5, ["", "Schedule email sequence", "Marketing", "➕"]);
    fillRow(g, 6, ["", "Build landing page", "Technical", "🔄"]);
    set(g, 7, 0, "Launch Day", 4, 1);
    fillRow(g, 7, ["", "Push the site live", "Technical", "todo"]);
    fillRow(g, 8, ["", "Post the announcement", "Marketing", "todo"]);
    fillRow(g, 9, ["", "Notify the whole team", "Management", "todo"]);
    fillRow(g, 10, ["", "Monitor signups", "Technical", "todo"]);
    set(g, 11, 0, "Post-Launch", 4, 1);
    fillRow(g, 11, ["", "Collect feedback", "Content", "todo"]);
    fillRow(g, 12, ["", "Patch issues", "Technical", "todo"]);
    fillRow(g, 13, ["", "Publish the recap", "Content", "todo"]);
    fillRow(g, 14, ["", "Retro with the team", "Management", "todo"]);

    tables.push({
      section: "MARKETING",
      name: "Campaign Launch Checklist",
      color: "#00E8A2",
      isDateBased: false,
      grid: g,
      stickers: [
        { id: "t3-think", sprite: "think", x: 74, y: 18, w: 112, locked: false, mirrored: false, state: "play" },
      ],
    });
  }

  /* 4 --------------------------------------------------- Art Asset Board
     Campaign merged bands + a sticker pair. */
  {
    const g = makeGrid(6, 13);
    g.sizes.cols = [190, 130, 130, 120, 150, 110];
    g.sizes.rows = [46, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52];
    fillRow(g, 0, ["Asset", "Type", "Campaign", "Assignee", "Stage", "Rev."]);
    set(g, 1, 2, "Winter Drop", 4, 1);
    fillRow(g, 1, ["Hero key art", "Illustration", "", "Mona", "✅ shipped", "v3"]);
    fillRow(g, 2, ["Carousel set", "Social", "", "Sami", "🔥 final pass", "v2"]);
    fillRow(g, 3, ["Sticker pack", "Pack", "", "Mona", "in review", "v1"]);
    fillRow(g, 4, ["Motion teaser", "Video", "", "Joud", "in review", "v2"]);
    set(g, 5, 2, "Rebrand", 5, 1);
    fillRow(g, 5, ["Logo refresh", "Identity", "", "Samia", "✅ shipped", "v5"]);
    fillRow(g, 6, ["Style guide", "Docs", "", "Mona", "in review", "v2"]);
    fillRow(g, 7, ["Icon library", "Kit", "", "Sami", "todo", "v1"]);
    fillRow(g, 8, ["Social covers", "Social", "", "Joud", "todo", "—"]);
    fillRow(g, 9, ["Avatar kit", "Pack", "", "Mona", "todo", "—"]);
    set(g, 10, 2, "Comms", 3, 1);
    fillRow(g, 10, ["Newsletter art", "Email", "", "Samia", "todo", "—"]);
    fillRow(g, 11, ["Web banners", "Web", "", "Joud", "todo", "—"]);
    fillRow(g, 12, ["Presentation deck", "Docs", "", "Sami", "todo", "—"]);

    tables.push({
      section: "ART",
      name: "Art Asset Board",
      color: "#7C3AED",
      isDateBased: false,
      grid: g,
      stickers: [
        { id: "t4-happy", sprite: "happy", x: 72, y: 12, w: 118, locked: false, mirrored: false, state: "play" },
        { id: "t4-think", sprite: "think", x: 16, y: 80, w: 106, locked: false, mirrored: true, state: "play" },
      ],
    });
  }

  /* 5 --------------------------------------------------- Sprint Velocity
     Date mode, row axis → today's row lights up (2026-09-22). */
  {
    const g = makeGrid(6, 9);
    g.sizes.cols = [112, 118, 118, 118, 140, 250];
    g.sizes.rows = [48, 54, 54, 54, 54, 54, 54, 54, 62];
    fillRow(g, 0, ["Day", "Commits", "Bugs closed", "PRs merged", "Focus", "Notes"]);
    set(g, 1, 4, "Auth & identity", 2, 1);
    fillRow(g, 1, ["2026-09-16", "3", "2", "1", "", "Session tokens wired"]);
    fillRow(g, 2, ["2026-09-17", "2", "1", "0", "", "SSO stub behind a flag"]);
    set(g, 3, 4, "Payments", 2, 1);
    fillRow(g, 3, ["2026-09-18", "4", "3", "2", "", "Checkout v1 merged"]);
    fillRow(g, 4, ["2026-09-21", "2", "0", "1", "", "Refunds + receipts"]);
    set(g, 5, 4, "Planning", 1, 1);
    fillRow(g, 5, ["2026-09-22", "1", "0", "0", "", "Retro + sprint 43 prep"]);
    set(g, 6, 4, "Deploy", 2, 1);
    fillRow(g, 6, ["2026-09-23", "3", "1", "1", "", "Staging env green"]);
    fillRow(g, 7, ["2026-09-24", "2", "0", "1", "", "Canary rollback script"]);
    set(g, 8, 0, "📦 17 points shipped · 9 bugs closed · sprint 42 in the bag", 1, 6);

    tables.push({
      section: "TECHNICAL",
      name: "Sprint Velocity",
      color: "#3B82F6",
      isDateBased: true,
      grid: g,
      stickers: [
        { id: "t5-wave", sprite: "wave", x: 78, y: 16, w: 112, locked: false, mirrored: true, state: "play" },
      ],
    });
  }

  /* 6 --------------------------------------------------- Team Budget Tracker
     Merged category bands + a summed TOTAL band. */
  {
    const g = makeGrid(5, 13);
    g.sizes.cols = [150, 230, 110, 110, 120];
    g.sizes.rows = [46, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 62];
    fillRow(g, 0, ["Category", "Item", "Budgeted", "Spent", "Remaining"]);
    set(g, 1, 0, "Team", 3, 1);
    fillRow(g, 1, ["", "Software licences", "2,400", "1,150", "1,250"]);
    fillRow(g, 2, ["", "Equipment", "3,000", "2,870", "130"]);
    fillRow(g, 3, ["", "Training", "1,200", "400", "800"]);
    set(g, 4, 0, "Marketing", 3, 1);
    fillRow(g, 4, ["", "Paid ads", "5,000", "3,100", "1,900"]);
    fillRow(g, 5, ["", "Content production", "3,500", "1,980", "1,520"]);
    fillRow(g, 6, ["", "Events", "2,000", "900", "1,100"]);
    set(g, 7, 0, "Operations", 3, 1);
    fillRow(g, 7, ["", "Office & tools", "1,800", "1,100", "700"]);
    fillRow(g, 8, ["", "Travel", "1,500", "240", "1,260"]);
    fillRow(g, 9, ["", "Subscriptions", "800", "620", "180"]);
    set(g, 10, 0, "Contingency", 2, 1);
    fillRow(g, 10, ["", "Buffer fund", "2,000", "0", "2,000"]);
    fillRow(g, 11, ["", "Hiring kit", "1,200", "750", "450"]);
    set(g, 12, 0, "TOTAL", 1, 2);
    fillRow(g, 12, ["", "", "25,400", "12,110", "13,290"]);

    tables.push({
      section: "MANAGEMENT",
      name: "Team Budget Tracker",
      color: "#F59E0B",
      isDateBased: false,
      grid: g,
      stickers: [
        { id: "t6-happy", sprite: "happy", x: 78, y: 20, w: 112, locked: false, mirrored: false, state: "play" },
      ],
    });
  }

  return tables;
}

/* ─── Database writes (Turso HTTP API) ───────────────────────────────────── */

function envVars(): Record<string, string> {
  const out: Record<string, string> = {};
  if (process.env.DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    out.DATABASE_URL = process.env.DATABASE_URL;
    out.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
    return out;
  }
  for (const line of readFileLines(".env")) {
    const i = line.indexOf("=");
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function readFileLines(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n");
}

async function query(sql: string, params: (string | number | null)[] = []): Promise<unknown[]> {
  const env = envVars();
  const host = env.DATABASE_URL.replace(/^libsql:\/\//, "").replace(/\/.*$/, "");
  const body = JSON.stringify({ statements: [{ q: sql, params }] });

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await new Promise<{
        status: number;
        text: string;
      }>((resolve, reject) => {
        const req = httpsRequest(
          { host, path: "/", method: "POST", headers: {
            Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          } },
          (r) => {
            const chunks: Buffer[] = [];
            r.on("data", (chunk: Buffer) => chunks.push(chunk));
            r.on("end", () =>
              resolve({ status: r.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }),
            );
          },
        );
        req.on("error", reject);
        req.setTimeout(150_000, () => req.destroy(new Error("Turso request timed out")));
        req.write(body);
        req.end();
      });

      if (res.status !== 200) throw new Error(`Turso HTTP ${res.status}: ${res.text}`);
      return parseResponse(res.text);
    } catch (err) {
      lastError = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

function parseResponse(text: string): unknown[] {
  const data = JSON.parse(text) as unknown[];
  const first = data[0] as { results?: { error?: string; rows?: unknown[]; columns?: string[] } } | undefined;
  if (!first?.results || typeof first.results !== "object") {
    throw new Error(`Turso batch failed: ${text}`);
  }
  const r = first.results;
  if (r.error) throw new Error(`Turso error: ${r.error}`);
  return r.rows ?? [];
}

async function main() {
  const tables = buildTables();

  for (const t of tables) {
    const nonNull = t.grid.rows.flat().filter((c) => c !== null).length;
    for (let r = 0; r < t.grid.rows.length; r++) {
      if (t.grid.rows[r].length !== t.grid.cols) {
        throw new Error(
          `${t.name}: row ${r} has ${t.grid.rows[r].length} cells, expected ${t.grid.cols}`,
        );
      }
    }
    if (
      t.grid.sizes.rows.length !== t.grid.rows.length ||
      t.grid.sizes.cols.length !== t.grid.cols
    ) {
      throw new Error(`${t.name}: sizes arrays out of sync with grid`);
    }
    console.log(
      `${t.name}  ${t.grid.rows.length}×${t.grid.cols}  ${nonNull} filled cells`,
    );
  }

  const adminRows = await query(
    `SELECT id FROM User WHERE role = 'ADMIN' ORDER BY createdAt LIMIT 1`,
  );
  const adminId = (adminRows as (string | null)[][])[0]?.[0] as string | undefined;
  if (!adminId) throw new Error("No admin user found — seed users first (npm run db:seed)");

  await query(`DELETE FROM TeamTable`);

  for (const t of tables) {
    const cellsJson = JSON.stringify(JSON.stringify(t.grid));
    const stickersJson = JSON.stringify(JSON.stringify(t.stickers));
    await query(
      `INSERT INTO TeamTable (id, section, name, color, cells, stickers, isDateBased, createdById, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        t.section,
        t.name,
        t.color,
        cellsJson,
        stickersJson,
        t.isDateBased ? 1 : 0,
        adminId,
      ],
    );
  }

  console.log(`\nReplaced all tables with ${tables.length} showcase tables ✅`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});