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

/**
 * Every coordinate any cell claims, including the ones a span merely covers.
 * A covered slot holds `null`, so the grid alone cannot distinguish "genuinely
 * empty" from "owned by the span above or to the left" — this map can.
 */
function occupiedMap(rows: GridCell[][]): Set<string> {
  const occupied = new Set<string>();
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      if (!cell) continue;
      for (let i = 0; i < cell.rs; i++) {
        for (let j = 0; j < cell.cs; j++) occupied.add(`${r + i},${c + j}`);
      }
    }
  }
  return occupied;
}

function isClaimable(
  rows: GridCell[][],
  occupied: Set<string>,
  r: number,
  c: number,
): boolean {
  const cell = rows[r]?.[c];
  // Null: claimable only if no other span reaches over it.
  if (cell === null || cell === undefined) return !occupied.has(`${r},${c}`);
  /* A live cell is an anchor, so it claims only itself; taking it over is safe
     precisely when it is an empty 1x1 placeholder, which discards no content.
     That second case is the common one: a densely populated grid has a live
     `{v:"",rs:1,cs:1}` in every unmerged position. */
  return cell.v === "" && cell.rs === 1 && cell.cs === 1;
}

/**
 * Write `cell` at (row, col), shrinking its span until the whole rectangle
 * lands on claimable cells. Returns false — writing nothing — when not even a
 * 1x1 cell fits because the target slot is already owned.
 *
 * The engine's core invariant is that every coordinate is either null or owned
 * by exactly one cell (a span's covered cells are null, never a second live
 * object). Rescuing content out of a deleted row or column moves a cell into a
 * slot that another span may already have shifted into, so a blind assignment
 * could give one coordinate two owners. Clamping the span to the free space
 * that is actually available keeps that invariant true for every input,
 * including states that only arise after a long sequence of edits.
 */
function placeCell(
  rows: GridCell[][],
  occupied: Set<string>,
  row: number,
  col: number,
  cell: NonNullable<GridCell>,
): boolean {
  if (row < 0 || row >= rows.length) return false;
  if (col < 0 || col >= rows[row].length) return false;
  if (!isClaimable(rows, occupied, row, col)) return false;

  // Free run to the right of the anchor, and downward beneath it.
  let width = 0;
  while (col + width < rows[row].length && isClaimable(rows, occupied, row, col + width)) {
    width++;
  }
  let height = 0;
  while (row + height < rows.length && isClaimable(rows, occupied, row + height, col)) {
    height++;
  }

  let cs = Math.min(cell.cs, width);
  const rs = Math.min(cell.rs, height);
  while (rs > 0 && cs > 0) {
    let free = true;
    for (let i = 0; i < rs && free; i++) {
      for (let j = 0; j < cs; j++) {
        if (!isClaimable(rows, occupied, row + i, col + j)) {
          free = false;
          break;
        }
      }
    }
    if (free) break;
    cs--;
  }
  if (rs < 1 || cs < 1) return false;

  // Commit: the anchor keeps the content, everything it covers becomes null.
  rows[row][col] = { v: cell.v, rs, cs };
  for (let i = 0; i < rs; i++) {
    for (let j = 0; j < cs; j++) {
      if (i === 0 && j === 0) continue;
      rows[row + i][col + j] = null;
      occupied.add(`${row + i},${col + j}`);
    }
  }
  return true;
}

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
  const newRow: GridCell[] = emptyRow(state.cols);

  // Grow spans that cross the insertion point
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && r <= idx && r + cell.rs - 1 > idx) {
        const grown = { ...cell, rs: cell.rs + 1 };
        next.rows[r][c] = grown;
        /* This span now reaches over the inserted row. The engine stores the
           cells a span covers as null, so leaving `newRow`'s live empty cells in
           place produced a double-covered grid: two live cells claiming the same
           coordinates, which then rendered and serialized incorrectly. */
        for (let j = 0; j < grown.cs; j++) {
          if (c + j < state.cols) newRow[c + j] = null;
        }
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

  /* Phase 2: remove the row FIRST, so the rescue below works in the final
     layout. The old row below shifts up into `row`, which is where the content
     belongs — indexing the pre-splice array (as this once did) wrote into the
     wrong row and could land on a coordinate another span already owned. */
  const rescued: { col: number; v: string; rs: number; cs: number }[] = [];
  for (let c = 0; c < state.cols; c++) {
    const cell = state.rows[row][c]; // read from ORIGINAL state
    /* A merge anchored in the deleted row is rescued whether it spans rows
       (rs > 1) or only columns (rs === 1, cs > 1). The latter used to be
       spliced away with its text, silently destroying the content of an
       ordinary horizontal merge when its row was deleted. */
    if (cell !== null && (cell.rs > 1 || cell.cs > 1)) {
      rescued.push({ col: c, v: cell.v, rs: Math.max(1, cell.rs - 1), cs: cell.cs });
    }
  }

  next.rows.splice(row, 1);
  if (next.sizes?.rows) next.sizes.rows.splice(row, 1);

  // Phase 3: re-place the rescued content, shrinking spans to the free space.
  if (rescued.length > 0) {
    const occupied = occupiedMap(next.rows);
    for (const r of rescued) {
      placeCell(next.rows, occupied, row, r.col, { v: r.v, rs: r.rs, cs: r.cs });
    }
  }
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
  const nullInsertedIn = new Set<number>();

  // Grow spans that cross the insertion point
  for (let r = 0; r < state.rows.length; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = next.rows[r][c];
      if (cell !== null && c <= idx && c + cell.cs - 1 > idx) {
        const grown = { ...cell, cs: cell.cs + 1 };
        next.rows[r][c] = grown;
        /* Same invariant as insertRow: every row the widened span reaches must
           take a null in the inserted column, not a live empty cell. */
        for (let i = 0; i < grown.rs; i++) {
          if (r + i < state.rows.length) nullInsertedIn.add(r + i);
        }
      }
    }
  }

  // Insert a new cell at the end of each row
  for (let r = 0; r < next.rows.length; r++) {
    next.rows[r].splice(idx + 1, 0, nullInsertedIn.has(r) ? null : { v: "", rs: 1, cs: 1 });
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

  /* Phase 2: note the content anchored in the deleted column, then remove the
     column so the rescue runs against the final layout (mirrors deleteRow). */
  const rescued: { row: number; v: string; rs: number; cs: number }[] = [];
  for (let r = 0; r < state.rows.length; r++) {
    const cell = state.rows[r][col]; // ORIGINAL
    /* Includes a merge that spans only ROWS (cs === 1, rs > 1): it is anchored
       in this column and used to disappear with its text when the column was
       deleted. */
    if (cell !== null && (cell.cs > 1 || cell.rs > 1)) {
      rescued.push({ row: r, v: cell.v, rs: cell.rs, cs: Math.max(1, cell.cs - 1) });
    }
  }

  // Phase 3: remove the column from each row
  for (let r = 0; r < next.rows.length; r++) {
    next.rows[r].splice(col, 1);
  }
  next.cols -= 1;
  if (next.sizes?.cols) next.sizes.cols.splice(col, 1);

  // Phase 4: re-place the rescued content, shrinking spans to the free space.
  if (rescued.length > 0) {
    const occupied = occupiedMap(next.rows);
    for (const r of rescued) {
      placeCell(next.rows, occupied, r.row, col, { v: r.v, rs: r.rs, cs: r.cs });
    }
  }
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
 *
 * Existing merges that overlap the selection are broken first: their anchor is
 * reduced to 1×1 (keeping its value) and any of its covered cells that fall
 * OUTSIDE the new rect are restored to empty cells. Without this, merging a
 * strip across the corner of a larger merge left dangling null cells, which
 * misaligned the rendered <table> and became impossible to click or edit.
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

  // Find the value at the top-left: prefer a cell with content, otherwise fall
  // back to the first non-null cell. This runs BEFORE the overlapped merges are
  // broken below, so a value living inside the rect is never lost.
  let topLeftCell: Exclude<GridCell, null> | null = null;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = next.rows[r][c];
      if (cell !== null) {
        if (topLeftCell === null) topLeftCell = cell;
        if (cell.v !== "") {
          topLeftCell = cell;
          r = maxR + 1;
          break;
        }
      }
    }
  }
  const src = topLeftCell ?? { v: "", rs: 1, cs: 1 };

  const rs = maxR - minR + 1;
  const cs = maxC - minC + 1;

  // Break every merged region that overlaps the new rect.
  for (let r = 0; r < next.rows.length; r++) {
    for (let c = 0; c < next.cols; c++) {
      const cell = next.rows[r][c];
      if (cell === null || (cell.rs === 1 && cell.cs === 1)) continue;
      const overlaps =
        r <= maxR &&
        r + cell.rs - 1 >= minR &&
        c <= maxC &&
        c + cell.cs - 1 >= minC;
      if (!overlaps) continue;

      // Restore this region's covered cells that fall outside the new rect.
      for (let dr = 0; dr < cell.rs; dr++) {
        for (let dc = 0; dc < cell.cs; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < minR || nr > maxR || nc < minC || nc > maxC) {
            if (inBounds(next, nr, nc)) {
              next.rows[nr][nc] = { v: "", rs: 1, cs: 1 };
            }
          }
        }
      }

      // Shrink an anchor that lies outside the new rect back to 1×1 but keep
      // its value; an anchor inside the rect is overwritten below anyway.
      if (r < minR || r > maxR || c < minC || c > maxC) {
        next.rows[r][c] = { v: cell.v, rs: 1, cs: 1 };
      }
    }
  }

  // Apply the new merge over the rect.
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (r === minR && c === minC) {
        next.rows[r][c] = { v: src.v, rs, cs };
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
