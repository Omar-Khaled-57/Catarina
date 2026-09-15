import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createGrid,
  setCell,
  insertRow,
  deleteRow,
  insertCol,
  deleteCol,
  mergeSelection,
  splitCell,
  setSize,
  resetSize,
  MAX_GRID_SIZE,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
  type GridState,
} from "@/lib/table/grid";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function vals(state: GridState): (string | null)[][] {
  return state.rows.map((row) =>
    row.map((c) => (c === null ? null : c.v)),
  );
}

/* ─── createGrid ─────────────────────────────────────────────────────────── */

describe("createGrid", () => {
  test("creates the requested dimensions", () => {
    const g = createGrid(3, 4);
    assert.equal(g.rows.length, 3);
    assert.equal(g.cols, 4);
    for (const row of g.rows) {
      assert.equal(row.length, 4);
      for (const c of row) {
        assert.deepEqual(c, { v: "", rs: 1, cs: 1 });
      }
    }
  });

  test("clamps to 1..MAX_GRID_SIZE", () => {
    assert.equal(createGrid(0, 0).rows.length, 1);
    assert.equal(createGrid(0, 0).cols, 1);
    assert.equal(createGrid(999, 999).rows.length, MAX_GRID_SIZE);
    assert.equal(createGrid(999, 999).cols, MAX_GRID_SIZE);
  });
});

/* ─── setCell ────────────────────────────────────────────────────────────── */

describe("setCell", () => {
  test("sets value on a normal cell", () => {
    const g = setCell(createGrid(2, 2), 0, 1, "hello");
    assert.equal(g.rows[0][1]?.v, "hello");
  });

  test("no-op on covered (null) cell", () => {
    const g = mergeSelection(createGrid(2, 2), 0, 0, 1, 1);
    const g2 = setCell(g, 1, 1, "oops");
    assert.equal(g2.rows[1][1], null);
  });

  test("no-op on out-of-bounds", () => {
    const g = createGrid(2, 2);
    assert.equal(setCell(g, 5, 5, "x"), g);
  });
});

/* ─── insertRow ──────────────────────────────────────────────────────────── */

describe("insertRow", () => {
  test("inserts after the specified row", () => {
    const g = setCell(createGrid(2, 2), 0, 0, "A");
    const g2 = insertRow(g, 0);
    assert.equal(g2.rows.length, 3);
    assert.equal(g2.rows[0][0]?.v, "A");
    assert.deepEqual(g2.rows[1][0], { v: "", rs: 1, cs: 1 });
  });

  test("grows spans crossing the insertion point", () => {
    const g = mergeSelection(createGrid(2, 2), 0, 0, 1, 0); // merge col 0
    const g2 = insertRow(g, 0);
    assert.equal(g2.rows[0][0]?.rs, 3); // was 2, now 3
    assert.equal(g2.rows.length, 3);
  });

  test("inserts at top when afterRow = -1", () => {
    const g = setCell(createGrid(2, 2), 0, 0, "A");
    const g2 = insertRow(g, -1);
    assert.equal(g2.rows.length, 3);
    assert.deepEqual(g2.rows[0][0], { v: "", rs: 1, cs: 1 });
    assert.equal(g2.rows[1][0]?.v, "A");
  });

  test("respects MAX_GRID_SIZE cap", () => {
    const g = createGrid(MAX_GRID_SIZE, 2);
    assert.equal(insertRow(g, 0), g);
  });
});

/* ─── deleteRow ──────────────────────────────────────────────────────────── */

describe("deleteRow", () => {
  test("deletes the specified row", () => {
    const g = setCell(createGrid(3, 2), 1, 0, "B");
    const g2 = deleteRow(g, 1);
    assert.equal(g2.rows.length, 2);
    assert.equal(vals(g2)[0][0], "");
    assert.equal(vals(g2)[1][0], "");
  });

  test("shrinks spans crossing from above", () => {
    // Merge (0,0)-(1,0), then delete row 1
    const g = mergeSelection(createGrid(3, 2), 0, 0, 1, 0);
    const g2 = deleteRow(g, 1);
    assert.equal(g2.rows[0][0]?.rs, 1); // was 2, crossed row 1 → shrunk
    assert.equal(g2.rows.length, 2);
  });

  test("drops content from deleted row when rs > 1", () => {
    // Merge (0,0)-(1,0) in a 3-row grid, then delete row 0
    const g = mergeSelection(createGrid(3, 2), 0, 0, 1, 0);
    const g2 = deleteRow(g, 0);
    // Cell at old row 0 col 0 had rs=2 starting at the deleted row → drops to survivor
    assert.equal(g2.rows.length, 2);
    assert.ok(g2.rows[0][0] !== null); // content survived
    assert.equal(g2.rows[0][0]?.rs, 1); // was 2, dropped to 1
  });

  test("keeps at least one row", () => {
    const g = createGrid(1, 2);
    assert.equal(deleteRow(g, 0), g);
  });

  test("no-op on out-of-bounds", () => {
    const g = createGrid(2, 2);
    assert.equal(deleteRow(g, 5), g);
  });
});

/* ─── insertCol ──────────────────────────────────────────────────────────── */

describe("insertCol", () => {
  test("inserts after the specified column", () => {
    const g = setCell(createGrid(2, 2), 0, 0, "A");
    const g2 = insertCol(g, 0);
    assert.equal(g2.cols, 3);
    assert.equal(g2.rows[0].length, 3);
    assert.equal(g2.rows[0][0]?.v, "A");
  });

  test("grows colspan crossing the insertion point", () => {
    const g = mergeSelection(createGrid(2, 3), 0, 0, 0, 1);
    const g2 = insertCol(g, 0);
    assert.equal(g2.rows[0][0]?.cs, 3); // was 2, now 3
    assert.equal(g2.cols, 4);
  });

  test("inserts at left when afterCol = -1", () => {
    const g = setCell(createGrid(2, 2), 0, 0, "A");
    const g2 = insertCol(g, -1);
    assert.equal(g2.cols, 3);
    assert.deepEqual(g2.rows[0][0], { v: "", rs: 1, cs: 1 });
    assert.equal(g2.rows[0][1]?.v, "A");
  });

  test("respects MAX_GRID_SIZE cap", () => {
    const g = createGrid(2, MAX_GRID_SIZE);
    assert.equal(insertCol(g, 0), g);
  });
});

/* ─── deleteCol ──────────────────────────────────────────────────────────── */

describe("deleteCol", () => {
  test("deletes the specified column", () => {
    const g = setCell(createGrid(2, 3), 0, 1, "B");
    const g2 = deleteCol(g, 1);
    assert.equal(g2.cols, 2);
    assert.equal(g2.rows[0].length, 2);
  });

  test("shrinks colspan crossing from the left", () => {
    const g = mergeSelection(createGrid(2, 3), 0, 0, 0, 1);
    const g2 = deleteCol(g, 1);
    assert.equal(g2.rows[0][0]?.cs, 1); // was 2, crossed col 1 → shrunk
    assert.equal(g2.cols, 2);
  });

  test("drops content from deleted col when cs > 1", () => {
    // Merge (0,0)-(0,1) in a 2×3 grid, then delete col 0
    const g = mergeSelection(createGrid(2, 3), 0, 0, 0, 1);
    const g2 = deleteCol(g, 0);
    assert.equal(g2.cols, 2);
    assert.ok(g2.rows[0][0] !== null); // survived
    assert.equal(g2.rows[0][0]?.cs, 1); // was 2, dropped to 1
  });

  test("keeps at least one column", () => {
    const g = createGrid(2, 1);
    assert.equal(deleteCol(g, 0), g);
  });
});

/* ─── mergeSelection ─────────────────────────────────────────────────────── */

describe("mergeSelection", () => {
  test("merges a 2×2 region", () => {
    const g0 = createGrid(3, 3);
    const g1 = setCell(g0, 0, 1, "X");
    const g2 = mergeSelection(g1, 0, 1, 1, 2);
    assert.equal(g2.rows[0][1]?.v, "X");
    assert.equal(g2.rows[0][1]?.rs, 2);
    assert.equal(g2.rows[0][1]?.cs, 2);
    assert.equal(g2.rows[0][2], null);
    assert.equal(g2.rows[1][1], null);
    assert.equal(g2.rows[1][2], null);
    // Cells outside the merge are untouched
    assert.deepEqual(g2.rows[0][0], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[2][0], { v: "", rs: 1, cs: 1 });
  });

  test("single-cell selection is a no-op", () => {
    const g = createGrid(2, 2);
    assert.equal(mergeSelection(g, 0, 0, 0, 0), g);
  });

  test("accepts reversed coordinates", () => {
    const g0 = createGrid(2, 2);
    const g1 = setCell(g0, 1, 1, "Y");
    const g2 = mergeSelection(g1, 1, 1, 0, 0); // reversed
    assert.equal(g2.rows[0][0]?.v, "Y");
    assert.equal(g2.rows[0][0]?.rs, 2);
    assert.equal(g2.rows[0][0]?.cs, 2);
  });
});

/* ─── splitCell ──────────────────────────────────────────────────────────── */

describe("splitCell", () => {
  test("splits a merged cell back to 1×1", () => {
    const g0 = createGrid(3, 3);
    const g1 = mergeSelection(g0, 0, 0, 1, 1);
    const g2 = splitCell(g1, 0, 0);
    assert.equal(g2.rows[0][0]?.rs, 1);
    assert.equal(g2.rows[0][0]?.cs, 1);
    // Covered cells become empty cells
    assert.deepEqual(g2.rows[0][1], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][0], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][1], { v: "", rs: 1, cs: 1 });
  });

  test("no-op on a 1×1 cell", () => {
    const g = createGrid(2, 2);
    assert.equal(splitCell(g, 0, 0), g);
  });

  test("no-op on null (covered) cell", () => {
    const g0 = createGrid(2, 2);
    const g1 = mergeSelection(g0, 0, 0, 1, 1);
    const g2 = splitCell(g1, 1, 1); // covered
    assert.equal(g2, g1);
  });

  test("no-op on out-of-bounds", () => {
    const g = createGrid(2, 2);
    assert.equal(splitCell(g, 5, 5), g);
  });
});

/* ─── setSize & sizes ────────────────────────────────────────────────────── */

describe("setSize & sizes", () => {
  test("createGrid carries a sizes array sized to the grid", () => {
    const g = createGrid(3, 4);
    assert.deepEqual(g.sizes?.rows, [null, null, null]);
    assert.deepEqual(g.sizes?.cols, [null, null, null, null]);
  });

  test("setSize sets a column width and clamps to [MIN, MAX]", () => {
    const g = createGrid(2, 2);
    const g2 = setSize(g, "cols", 1, 200);
    assert.equal(g2.sizes?.cols?.[1], 200);
    const g3 = setSize(g2, "cols", 1, 5);
    assert.equal(g3.sizes?.cols?.[1], MIN_CELL_SIZE);
    const g4 = setSize(g3, "cols", 1, 9999);
    assert.equal(g4.sizes?.cols?.[1], MAX_CELL_SIZE);
  });

  test("setSize sets a row height", () => {
    const g = createGrid(2, 2);
    const g2 = setSize(g, "rows", 0, 90);
    assert.equal(g2.sizes?.rows?.[0], 90);
  });

  test("setSize no-ops out of bounds (reading plain state without sizes)", () => {
    const g: GridState = { rows: createGrid(2, 2).rows, cols: 2 };
    assert.equal(setSize(g, "cols", 2, 100), g);
    assert.equal(setSize(g, "rows", 2, 100), g);
  });

  test("resetSize restores automatic sizing and prunes trailing nulls", () => {
    let g = createGrid(2, 3);
    g = setSize(g, "cols", 0, 300);
    g = setSize(g, "cols", 1, 200);
    g = setSize(g, "cols", 2, 120);
    const g2 = resetSize(g, "cols", 1);
    assert.deepEqual(g2.sizes?.cols, [300, null, 120]);
    const g3 = resetSize(g2, "cols", 2);
    assert.deepEqual(g3.sizes?.cols, [300]);
    assert.equal(resetSize(g3, "rows", 0), g3); // nothing stored → no-op
  });

  test("sizes stay in sync on insert/delete of rows", () => {
    let g = createGrid(3, 2);
    g = setSize(g, "rows", 0, 80);
    g = setSize(g, "rows", 2, 120);
    g = insertRow(g, 0); // new row lands AFTER row 0
    assert.equal(g.sizes?.rows?.[0], 80); // untouched
    assert.equal(g.sizes?.rows?.[1], null); // brand-new row
    assert.equal(g.sizes?.rows?.[3], 120); // shifted +1
    assert.equal(g.sizes?.rows?.length, 4);
    g = deleteRow(g, 1); // remove the brand-new row
    assert.equal(g.sizes?.rows?.length, 3);
    assert.deepEqual(g.sizes?.rows, [80, null, 120]);
  });

  test("sizes stay in sync on insert/delete of columns", () => {
    let g = createGrid(2, 3);
    g = setSize(g, "cols", 0, 300);
    g = setSize(g, "cols", 2, 200);
    g = insertCol(g, 0); // new column lands AFTER column 0
    assert.equal(g.sizes?.cols?.length, 4);
    assert.equal(g.sizes?.cols?.[0], 300); // untouched
    assert.equal(g.sizes?.cols?.[1], null); // brand-new column
    assert.equal(g.sizes?.cols?.[3], 200); // shifted +1
    g = deleteCol(g, 0);
    assert.equal(g.sizes?.cols?.length, 3);
    assert.deepEqual(g.sizes?.cols, [null, null, 200]);
  });

  test("merge/split preserve sizes untouched", () => {
    let g = createGrid(3, 3);
    g = setSize(g, "cols", 0, 250);
    const g2 = mergeSelection(g, 0, 0, 1, 1);
    assert.deepEqual(g2.sizes?.cols, [250, null, null]);
    const g3 = splitCell(g2, 0, 0);
    assert.deepEqual(g3.sizes?.cols, [250, null, null]);
    assert.equal(g3.sizes?.rows?.length, 3);
  });
});

/* ─── Round-trip: merge then split restores empty cells ──────────────────── */

describe("round-trip", () => {
  test("merge + split restores the grid structure", () => {
    const g0 = createGrid(3, 3);
    const g1 = mergeSelection(g0, 0, 0, 1, 1);
    const g2 = splitCell(g1, 0, 0);
    // All cells should be 1×1 empty
    for (const row of g2.rows) {
      for (const c of row) {
        assert.deepEqual(c, { v: "", rs: 1, cs: 1 });
      }
    }
  });

  test("insertRow + deleteRow preserves a simple grid", () => {
    let g = createGrid(2, 2);
    g = setCell(g, 0, 0, "A");
    g = insertRow(g, 0); // 3 rows
    g = deleteRow(g, 1); // back to 2 rows, row 0 still has A
    assert.equal(g.rows.length, 2);
    assert.equal(g.rows[0][0]?.v, "A");
  });
});
