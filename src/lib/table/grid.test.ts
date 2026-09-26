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

  test("merging a strip over an existing merge leaves no orphaned covered cells", () => {
    const g0 = createGrid(3, 4);
    const g1 = mergeSelection(g0, 0, 0, 1, 1); // 2×2 merge anchored at (0,0)
    const g2 = mergeSelection(g1, 0, 0, 0, 3); // band-merge row 0 over it
    // New anchor spans row 0 (1×4), value kept from the old merge.
    assert.equal(g2.rows[0][0]?.rs, 1);
    assert.equal(g2.rows[0][0]?.cs, 4);
    assert.equal(g2.rows[0][0]?.v, "");
    // Exposed formerly-covered cells are restored, never orphaned.
    assert.deepEqual(g2.rows[1][0], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][1], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][2], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][3], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[2][0], { v: "", rs: 1, cs: 1 });
  });

  test("merging over the corner of a larger merge shrinks it and restores leftovers", () => {
    const g0 = createGrid(3, 3);
    const g1 = mergeSelection(g0, 0, 0, 1, 1); // 2×2 anchored at (0,0)
    const g2 = mergeSelection(g1, 1, 1, 1, 2); // band-merge row 1 over its corner
    // Old anchor outside the new rect is slimmed to 1×1 (value kept).
    assert.deepEqual(g2.rows[0][0], { v: "", rs: 1, cs: 1 });
    // New 1×2 merge anchors at (1,1); (1,2) covered.
    assert.deepEqual(g2.rows[1][1], { v: "", rs: 1, cs: 2 });
    assert.equal(g2.rows[1][2], null);
    // Exposed covered cells are empty cells, not orphans.
    assert.deepEqual(g2.rows[0][1], { v: "", rs: 1, cs: 1 });
    assert.deepEqual(g2.rows[1][0], { v: "", rs: 1, cs: 1 });
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

/* ─── Merge preservation across row/column insert & delete ─────────────────
 * A merged cell is represented by ONE anchor carrying rs/cs; the cells it
 * covers are null. These operations used to lose the anchor's text, or leave
 * live cells underneath a widened span (two cells claiming one coordinate).
 * `assertNoOverlapOrphans` is the invariant both classes of bug violate.
 * ─────────────────────────────────────────────────────────────────────────── */

function assertNoOverlapOrphans(state: GridState): void {
  const claimed = new Set<string>();
  state.rows.forEach((row, r) => {
    assert.equal(row.length, state.cols, `row ${r} is not ${state.cols} wide`);
    row.forEach((cell, c) => {
      if (!cell) return;
      const rs = cell.rs ?? 1;
      const cs = cell.cs ?? 1;
      assert.ok(r + rs <= state.rows.length, `span at ${r},${c} overflows rows`);
      assert.ok(c + cs <= state.cols, `span at ${r},${c} overflows cols`);
      for (let i = 0; i < rs; i++) {
        for (let j = 0; j < cs; j++) {
          const key = `${r + i},${c + j}`;
          assert.ok(!claimed.has(key), `two cells claim ${key}`);
          claimed.add(key);
          if (i === 0 && j === 0) continue;
          assert.equal(
            state.rows[r + i]?.[c + j] ?? null,
            null,
            `cell at ${r},${c} covers a live cell at ${r + i},${c + j}`,
          );
        }
      }
    });
  });
}

describe("merged cells survive row and column deletion", () => {
  test("deleting a row keeps a column-spanning merge's text", () => {
    let g = setCell(createGrid(3, 3), 0, 0, "Sprint goal");
    g = mergeSelection(g, 0, 0, 0, 2); // 1 row x 3 cols
    const after = deleteRow(g, 0);
    assert.equal(vals(after)[0][0], "Sprint goal", "text was destroyed");
    assertNoOverlapOrphans(after);
  });

  test("deleting a column keeps a row-spanning merge's text", () => {
    let g = setCell(createGrid(3, 3), 0, 0, "Owner");
    g = mergeSelection(g, 0, 0, 2, 0); // 3 rows x 1 col
    const after = deleteCol(g, 0);
    assert.equal(after.rows[0][0]?.v, "Owner", "text was destroyed");
    assertNoOverlapOrphans(after);
  });

  test("deleting a row keeps a 3x3 block's text and shrinks it", () => {
    let g = setCell(createGrid(4, 4), 0, 0, "Both");
    g = mergeSelection(g, 0, 0, 2, 2);
    const after = deleteRow(g, 0);
    assert.equal(after.rows[0][0]?.v, "Both");
    assert.equal(after.rows[0][0]?.rs, 2, "rowspan should shrink by one");
    assert.equal(after.rows[0][0]?.cs, 3, "colspan should be unchanged");
    assertNoOverlapOrphans(after);
  });

  test("deleting a column keeps a 3x3 block's text and shrinks it", () => {
    let g = setCell(createGrid(4, 4), 0, 0, "Both");
    g = mergeSelection(g, 0, 0, 2, 2);
    const after = deleteCol(g, 0);
    assert.equal(after.rows[0][0]?.v, "Both");
    assert.equal(after.rows[0][0]?.cs, 2, "colspan should shrink by one");
    assert.equal(after.rows[0][0]?.rs, 3, "rowspan should be unchanged");
    assertNoOverlapOrphans(after);
  });

  test("deleting the last row or column of a block drops the merge safely", () => {
    let g = setCell(createGrid(4, 4), 0, 0, "Both");
    g = mergeSelection(g, 0, 0, 2, 2);
    let rows = g;
    for (let i = 0; i < 3; i++) rows = deleteRow(rows, 0);
    assert.equal(rows.rows.length, 1);
    assertNoOverlapOrphans(rows);
    let cols = g;
    for (let i = 0; i < 3; i++) cols = deleteCol(cols, 0);
    assert.equal(cols.cols, 1);
    assertNoOverlapOrphans(cols);
  });
});

describe("merges absorb an inserted row or column without double-covering", () => {
  test("inserting a row inside a block leaves the new row covered", () => {
    let g = setCell(createGrid(4, 4), 0, 0, "Both");
    g = mergeSelection(g, 0, 0, 2, 2);
    const after = insertRow(g, 0);
    assertNoOverlapOrphans(after);
    assert.equal(vals(after).flat().filter(Boolean).length, 1, "only the merge has content");
  });

  test("inserting a column inside a block leaves the new column covered", () => {
    let g = setCell(createGrid(4, 4), 0, 0, "Both");
    g = mergeSelection(g, 0, 0, 2, 2);
    const after = insertCol(g, 0);
    assertNoOverlapOrphans(after);
    assert.equal(vals(after).flat().filter(Boolean).length, 1);
  });

  test("inserting a row below an unrelated merge keeps the new row editable", () => {
    // merge occupies row 0 only; inserting at row 1 must not touch it
    let g = setCell(createGrid(4, 3), 0, 0, "Top");
    g = mergeSelection(g, 0, 0, 0, 1);
    const after = insertRow(g, 1);
    assert.equal(after.rows[0][0]?.v, "Top");
    assert.equal(after.rows[0][0]?.cs, 2, "colspan untouched");
    assert.deepEqual(after.rows[2][0], { v: "", rs: 1, cs: 1 }, "new row is a live cell");
    assertNoOverlapOrphans(after);
  });

  test("random operations never produce overlapping or orphaned cells", () => {
    let g = createGrid(5, 5);
    let seed = 12345;
    const rnd = (n: number) => {
      // deterministic LCG so a failure is reproducible
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let i = 0; i < 2000 && g.rows.length > 1 && g.cols > 1; i++) {
      switch (rnd(6)) {
        case 0:
          g = insertRow(g, rnd(g.rows.length) - 1);
          break;
        case 1:
          g = insertCol(g, rnd(g.cols) - 1);
          break;
        case 2:
          g = deleteRow(g, rnd(g.rows.length));
          break;
        case 3:
          g = deleteCol(g, rnd(g.cols));
          break;
        case 4:
          g = mergeSelection(
            g,
            rnd(g.rows.length),
            rnd(g.cols),
            rnd(g.rows.length),
            rnd(g.cols),
          );
          break;
        default:
          g = setCell(g, rnd(g.rows.length), rnd(g.cols), `v${i}`);
      }
      assertNoOverlapOrphans(g);
    }
  });
});
