/**
 * Date-mode helpers for TeamTable.
 *
 * Detects a date axis (row or column), parses date cell values, and
 * identifies which strip to highlight as "today".
 */

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type DateAxis = "cols" | "rows" | null;

/* ─── Constants ──────────────────────────────────────────────────────────── */

/** ISO-ish date patterns we accept in cells. */
const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/* ─── Parsing ────────────────────────────────────────────────────────────── */

/** Parse a cell string as a Date (YYYY-MM-DD). Returns null on failure. */
export function parseDateCell(value: string): Date | null {
  if (!value) return null;
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // Validate: month/day must match (handles e.g. 2026-02-30 → Mar 2)
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/* ─── Day of Week Parsing ─────────────────────────────────────────────────── */

const DAY_MAP: Record<string, number> = {
  // Sunday (0)
  sun: 0,
  sunday: 0,
  // Monday (1)
  mon: 1,
  monday: 1,
  // Tuesday (2)
  tue: 2,
  tues: 2,
  tuesday: 2,
  // Wednesday (3)
  wed: 3,
  wednesday: 3,
  // Thursday (4)
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  // Friday (5)
  fri: 5,
  friday: 5,
  // Saturday (6)
  sat: 6,
  saturday: 6,
};

/**
 * Parse a cell string as a day of the week (0 = Sun, ..., 6 = Sat).
 *
 * Exact match only — a substring search would read "mon" inside "Common" as
 * Monday, which combined with the forgiving axis threshold below would flag
 * ordinary headers ("Task | Owner | Monday notes") as a day axis.
 */
export function parseDayOfWeek(value: string): number | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  return DAY_MAP[clean] ?? null;
}

/* ─── Axis detection ─────────────────────────────────────────────────────── */

/**
 * A lone date-like cell must not declare an axis. The ratio test alone is not
 * enough: with a single non-empty header cell that happens to be a date, the
 * ratio is 1.0 and the column would be highlighted as a day axis. Two or more
 * independent matches is the smallest evidence that the cells are a run of
 * dates rather than one label that looks like a date.
 */
const MIN_AXIS_DATES = 2;

/**
 * Detect the date/day axis for the grid.
 *
 * 1. Scan the header row (row 0) — if enough non-empty cells parse as dates or
 *    day names, the axis is COLUMNS.
 * 2. Else scan the first column — same test, the axis is ROWS.
 * 3. Otherwise null (no date/day axis found).
 *
 * "Enough" = more than 30% of the non-empty cells in the candidate axis AND at
 * least {@link MIN_AXIS_DATES} of them. The ratio is deliberately looser than a
 * strict majority because day names are short and headers often mix them with a
 * label; the absolute minimum is what stops a single stray date from matching.
 *
 * KNOWN LIMITATION: the column axis is only looked for in row 0, so a table
 * whose date header sits under a title row gets no "today" highlight. Widening
 * the scan needs the axis to carry which row it matched (todayIndex reads the
 * same row), so it is left alone rather than half-changed.
 */
export function detectDateAxis(
  rows: (string | null)[][],
  colCount: number,
): DateAxis {
  if (rows.length === 0 || colCount === 0) return null;

  // 1. Check header row (row 0) for column dates or day names
  const headerRow = rows[0];
  if (headerRow) {
    let total = 0;
    let dates = 0;
    for (let c = 0; c < colCount; c++) {
      const v = headerRow[c] ?? "";
      if (v.trim() === "") continue;
      total++;
      if (parseDateCell(v) !== null || parseDayOfWeek(v) !== null) dates++;
    }
    if (total > 0 && dates >= MIN_AXIS_DATES && dates / total > 0.3) return "cols";
  }

  // 2. Check first column for row dates or day names
  let total = 0;
  let dates = 0;
  for (let r = 0; r < rows.length; r++) {
    const v = rows[r]?.[0] ?? "";
    if (v.trim() === "") continue;
    total++;
    if (parseDateCell(v) !== null || parseDayOfWeek(v) !== null) dates++;
  }
  if (total > 0 && dates >= MIN_AXIS_DATES && dates / total > 0.3) return "rows";

  return null;
}

/* ─── Today helpers ───────────────────────────────────────────────────────── */

/** Check whether two dates represent the same calendar day. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Return the index (column or row) that contains today, or -1 if not found.
 * Matches YYYY-MM-DD dates as well as day names (Sun, Monday, …).
 * `axis` must be non-null.
 */
export function todayIndex(
  rows: (string | null)[][],
  colCount: number,
  axis: DateAxis,
): number {
  if (!axis) return -1;
  const today = new Date();
  const todayDay = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  if (axis === "cols") {
    const headerRow = rows[0];
    if (!headerRow) return -1;
    for (let c = 0; c < colCount; c++) {
      const v = headerRow[c] ?? "";
      const d = parseDateCell(v);
      if (d && sameDay(d, today)) return c;
      const dayNum = parseDayOfWeek(v);
      if (dayNum !== null && dayNum === todayDay) return c;
    }
  } else {
    for (let r = 0; r < rows.length; r++) {
      const v = rows[r]?.[0] ?? "";
      const d = parseDateCell(v);
      if (d && sameDay(d, today)) return r;
      const dayNum = parseDayOfWeek(v);
      if (dayNum !== null && dayNum === todayDay) return r;
    }
  }

  return -1;
}
