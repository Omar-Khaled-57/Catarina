/**
 * Pure, immutable grid engine for TeamTable.
 *
 * Every operation returns a NEW GridState — callers never mutate
 * the input.  Unit-tested in grid.test.ts.
 */

/* ─── Types ──────────────────────────────────────────────────────────────── */

/** A single cell: value + rowspan/colspan, or null when covered by a merge. */
export type GridCell = { v: string; rs: number; cs: number } | null;

/** Full grid state: a 2D row array + column count (monotonic). */
export interface GridState {
  rows: GridCell[][];
  cols: number;
  /** Optional pixel sizes: row heights / col widths (null = auto). Kept in
      sync by every row/col mutation so resize survives insert/delete. */
  sizes?: GridSizes;
}

/** Pixel sizes per row (height) and per column (width); null = auto. */
export interface GridSizes {
  rows?: (number | null)[];
  cols?: (number | null)[];
}

export const MAX_GRID_SIZE = 200;
export const MIN_CELL_SIZE = 48;
export const MAX_CELL_SIZE = 640;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function cloneCell(c: GridCell): GridCell {
  return c === null ? null : { ...c };
}

function cloneRows(rows: GridCell[][]): GridCell[][] {
  return rows.map((row) => row.map(cloneCell));
}

function cloneSizes(sizes: GridSizes | undefined): GridSizes | undefined {
  if (!sizes) return undefined;
  return {
    rows: sizes.rows ? [...sizes.rows] : undefined,
    cols: sizes.cols ? [...sizes.cols] : undefined,
  };
}

function clone(state: GridState): GridState {
  return { rows: cloneRows(state.rows), cols: state.cols, sizes: cloneSizes(state.sizes) };
}

/** Ensure the sizes arrays cover the current grid dimensions. */
export function ensureSizes(state: GridState): GridState {
  const sizes = state.sizes ?? {};
  const rows = sizes.rows ? [...sizes.rows] : [];
  const cols = sizes.cols ? [...sizes.cols] : [];
  while (rows.length < state.rows.length) rows.push(null);
  while (rows.length > state.rows.length) rows.pop();
  while (cols.length < state.cols) cols.push(null);
  while (cols.length > state.cols) cols.pop();
  return { ...state, sizes: { rows, cols } };
}

function inBounds(state: GridState, r: number, c: number): boolean {
  return r >= 0 && r < state.rows.length && c >= 0 && c < state.cols;
}

function emptyRow(cols: number): GridCell[] {
  return Array.from({ length: cols }, () => ({ v: "", rs: 1, cs: 1 }));
}

/* ─── Core operations ────────────────────────────────────────────────────── */

/** Create a fresh grid filled with empty cells. */
export function createGrid(rows: number, cols: number): GridState {
  const clampedRows = Math.max(1, Math.min(rows, MAX_GRID_SIZE));
  const clampedCols = Math.max(1, Math.min(cols, MAX_GRID_SIZE));
  return {
    rows: Array.from({ length: clampedRows }, () => emptyRow(clampedCols)),
    cols: clampedCols,
    sizes: {
      rows: Array.from({ length: clampedRows }, () => null),
      cols: Array.from({ length: clampedCols }, () => null),
    },
  };
}

/** Set the value of cell (r, c).  No-op when the cell is covered by a merge. */
export function setCell(
  state: GridState,
  r: number,
  c: number,
  value: string,
): GridState {
  if (!inBounds(state, r, c)) return state;
  const cell = state.rows[r][c];
  if (cell === null) return state; // covered — ignore
  const next = clone(state);
  next.rows[r][c] = { ...cell, v: value };
  return next;
}

/**
 * Insert a new empty row AFTER `afterRow`.
 * Spans that cross the insertion line grow by 1 in rowspan.
 * `afterRow = -1` inserts at the top.
 */
export function insertRow(state: GridState, afterRow: number): GridState {
  const totalRows = state.rows.length;
  if (totalRows >= MAX_GRID_SIZE) return state;
  const idx = Math.max(-1, Math.min(afterRow, totalRows - 1));

  const next = clone(state);
  const newRow = emptyRow(state.cols);

  // Grow spans that cross the insertion point
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && r <= idx && r + cell.rs - 1 > idx) {
        next.rows[r][c] = { ...cell, rs: cell.rs + 1 };
      }
    }
  }

  next.rows.splice(idx + 1, 0, newRow);
  if (next.sizes?.rows) next.sizes.rows.splice(idx + 1, 0, null);
  return next;
}

/**
 * Delete the row at `row`.
 * - Spans that cross the deleted row shrink by 1 in rowspan.
 * - Cells that START at the deleted row with rs > 1 "drop" their content
 *   to the survivor row below (the first null cell in their column).
 * - Cells with rs === 1 at the deleted row are simply removed.
 */
export function deleteRow(state: GridState, row: number): GridState {
  if (row < 0 || row >= state.rows.length) return state;
  if (state.rows.length <= 1) return state; // keep at least one row

  const next = clone(state);

  // Phase 1: shrink spans that cross the deleted row from above
  for (let r = 0; r < row; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && r + cell.rs - 1 >= row) {
        next.rows[r][c] = { ...cell, rs: cell.rs - 1 };
      }
    }
  }

  // Phase 2: cells that start at the deleted row with rs > 1
  //   → their content survives with rs-1 at the row BELOW (which shifts up after splice)
  const hasSurvivor = row + 1 < state.rows.length;
  if (hasSurvivor) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.rows[row][c]; // read from ORIGINAL state
      if (cell !== null && cell.rs > 1) {
        // Place the reduced cell at the row below (survivor shifts up after splice)
        next.rows[row + 1][c] = {
          v: cell.v,
          rs: cell.rs - 1,
          cs: cell.cs,
        };
      }
    }
  }

  // Phase 3: remove the row
  next.rows.splice(row, 1);
  if (next.sizes?.rows) next.sizes.rows.splice(row, 1);
  return next;
}

/**
 * Insert a new empty column AFTER `afterCol`.
 * Spans that cross the insertion line grow by 1 in colspan.
 * `afterCol = -1` inserts at the left.
 */
export function insertCol(state: GridState, afterCol: number): GridState {
  if (state.cols >= MAX_GRID_SIZE) return state;
  const idx = Math.max(-1, Math.min(afterCol, state.cols - 1));

  const next = clone(state);

  // Grow spans that cross the insertion point
  for (let r = 0; r < state.rows.length; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && c <= idx && c + cell.cs - 1 > idx) {
        next.rows[r][c] = { ...cell, cs: cell.cs + 1 };
      }
    }
  }

  // Insert a new cell at the end of each row
  for (let r = 0; r < next.rows.length; r++) {
    next.rows[r].splice(idx + 1, 0, { v: "", rs: 1, cs: 1 });
  }
  next.cols += 1;
  if (next.sizes?.cols) next.sizes.cols.splice(idx + 1, 0, null);
  return next;
}

/**
 * Delete the column at `col`.
 * - Spans that cross the deleted column shrink by 1 in colspan.
 * - Cells that START at the deleted column with cs > 1 "drop" their content
 *   to the survivor column to the right (the first null cell in their row).
 * - Cells with cs === 1 at the deleted column are simply removed.
 */
export function deleteCol(state: GridState, col: number): GridState {
  if (col < 0 || col >= state.cols) return state;
  if (state.cols <= 1) return state; // keep at least one col

  const next = clone(state);

  // Phase 1: shrink spans that cross the deleted column from the left
  for (let r = 0; r < state.rows.length; r++) {
    for (let c = 0; c < col; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && c + cell.cs - 1 >= col) {
        next.rows[r][c] = { ...cell, cs: cell.cs - 1 };
      }
    }
  }

  // Phase 2: cells starting at deleted col with cs > 1 drop right
  const hasSurvivor = col + 1 < state.cols;
  if (hasSurvivor) {
    for (let r = 0; r < state.rows.length; r++) {
      const cell = state.rows[r][col]; // ORIGINAL
      if (cell !== null && cell.cs > 1) {
        // Place at col+1 (survivor shifts left after splice)
        next.rows[r][col + 1] = {
          v: cell.v,
          rs: cell.rs,
          cs: cell.cs - 1,
        };
      }
    }
  }

  // Phase 3: remove the column from each row
  for (let r = 0; r < next.rows.length; r++) {
    next.rows[r].splice(col, 1);
  }
  next.cols -= 1;
  if (next.sizes?.cols) next.sizes.cols.splice(col, 1);
  return next;
}

/**
 * Set the pixel height of a row (axis="rows") or width of a column
 * (axis="cols"). Clamped to [MIN_CELL_SIZE, MAX_CELL_SIZE].
 */
export function setSize(
  state: GridState,
  axis: "rows" | "cols",
  index: number,
  px: number,
): GridState {
  if (index < 0) return state;
  const bound = axis === "rows" ? state.rows.length : state.cols;
  if (index >= bound) return state;

  const next = clone(state);
  const base = next.sizes ?? {};
  const arr = base[axis] ? [...base[axis]] : Array.from({ length: bound }, () => null);
  while (arr.length < bound) arr.push(null);
  arr[index] = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.round(px)));
  next.sizes = { ...base, [axis]: arr };
  return next;
}

/**
 * Forget the stored pixel size of a row (axis="rows") or column (axis="cols"),
 * restoring automatic sizing. Trailing nulls are pruned.
 */
export function resetSize(
  state: GridState,
  axis: "rows" | "cols",
  index: number,
): GridState {
  if (index < 0) return state;
  const base = state.sizes?.[axis];
  if (!base || base[index] == null) return state;
  const arr = base.map((v, i) => (i === index ? null : v));
  while (arr.length && arr[arr.length - 1] === null) arr.pop();
  const next = clone(state);
  next.sizes = { ...state.sizes, [axis]: arr };
  return next;
}

/**
 * Merge a rectangular selection into a single cell.
 * Coordinates can be in any order (r1 may be > r2, etc.).
 * The top-left cell keeps its value; all covered cells → null.
 * The merged region is clamped to the grid bounds.
 */
export function mergeSelection(
  state: GridState,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): GridState {
  const minR = Math.max(0, Math.min(r1, r2));
  const minC = Math.max(0, Math.min(c1, c2));
  const maxR = Math.min(state.rows.length - 1, Math.max(r1, r2));
  const maxC = Math.min(state.cols - 1, Math.max(c1, c2));

  if (minR === maxR && minC === maxC) return state; // single cell — nothing to merge

  const next = clone(state);

  // Find the value at the top-left (skip nulls — walk forward to find a value)
  let topLeftValue = "";
  for (let r = minR; r <= maxR && topLeftValue === ""; r++) {
    for (let c = minC; c <= maxC && topLeftValue === ""; c++) {
      const cell = next.rows[r][c];
      if (cell !== null) topLeftValue = cell.v;
    }
  }

  const rs = maxR - minR + 1;
  const cs = maxC - minC + 1;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (r === minR && c === minC) {
        next.rows[r][c] = { v: topLeftValue, rs, cs };
      } else {
        next.rows[r][c] = null;
      }
    }
  }

  return next;
}

/**
 * Split a merged cell back to 1×1.
 * If the cell is already 1×1 or is null (covered), this is a no-op.
 * All previously covered cells in the region become empty cells.
 */
export function splitCell(
  state: GridState,
  r: number,
  c: number,
): GridState {
  if (!inBounds(state, r, c)) return state;
  const cell = state.rows[r][c];
  if (cell === null || (cell.rs === 1 && cell.cs === 1)) return state;

  const next = clone(state);
  const { rs, cs } = cell;

  // Restore the top-left to a single cell
  next.rows[r][c] = { ...cell, rs: 1, cs: 1 };

  // Fill covered cells with empty cells
  for (let dr = 0; dr < rs; dr++) {
    for (let dc = 0; dc < cs; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds({ rows: next.rows, cols: next.cols }, nr, nc)) {
        next.rows[nr][nc] = { v: "", rs: 1, cs: 1 };
      }
    }
  }

  return next;
}
