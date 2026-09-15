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

/* ─── Axis detection ─────────────────────────────────────────────────────── */

/**
 * Detect the date axis for the grid.
 *
 * 1. Scan the header row (row 0) — if most non-empty cells parse as dates,
 *    the axis is COLUMNS.
 * 2. Else scan the first column — if most non-empty cells parse as dates,
 *    the axis is ROWS.
 * 3. Otherwise null (no date axis found).
 *
 * "Most" = >50% of non-empty cells in the candidate axis.
 */
export function detectDateAxis(
  rows: (string | null)[][],
  colCount: number,
): DateAxis {
  if (rows.length === 0 || colCount === 0) return null;

  // 1. Check header row (row 0) for column dates
  const headerRow = rows[0];
  if (headerRow) {
    let total = 0;
    let dates = 0;
    for (let c = 0; c < colCount; c++) {
      const v = headerRow[c] ?? "";
      if (v.trim() === "") continue;
      total++;
      if (parseDateCell(v)) dates++;
    }
    if (total > 0 && dates / total > 0.5) return "cols";
  }

  // 2. Check first column for row dates
  let total = 0;
  let dates = 0;
  for (let r = 0; r < rows.length; r++) {
    const v = rows[r]?.[0] ?? "";
    if (v.trim() === "") continue;
    total++;
    if (parseDateCell(v)) dates++;
  }
  if (total > 0 && dates / total > 0.5) return "rows";

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
 * `axis` must be non-null.
 */
export function todayIndex(
  rows: (string | null)[][],
  colCount: number,
  axis: DateAxis,
): number {
  if (!axis) return -1;
  const today = new Date();

  if (axis === "cols") {
    const headerRow = rows[0];
    if (!headerRow) return -1;
    for (let c = 0; c < colCount; c++) {
      const d = parseDateCell(headerRow[c] ?? "");
      if (d && sameDay(d, today)) return c;
    }
  } else {
    for (let r = 0; r < rows.length; r++) {
      const d = parseDateCell(rows[r]?.[0] ?? "");
      if (d && sameDay(d, today)) return r;
    }
  }

  return -1;
}
