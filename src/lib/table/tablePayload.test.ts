/**
 * Tests for the server-side table payload bounds.
 *
 * These are the checks that were missing when a single ordinary member could
 * write an unbounded blob into a shared `TeamTable` row: the old validation
 * only looked at the OUTER dimensions, so `rows.length`/`cols` passed while the
 * content was arbitrarily large. Each test below reproduces that gap.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCell,
  validateSticker,
  validateCells,
  validateStickers,
  MAX_CELL_TEXT,
  MAX_STICKERS,
  MAX_SERIALIZED_BYTES,
} from "./tablePayload";
import { MAX_GRID_SIZE } from "./grid";

const cell = (v = "x", rs = 1, cs = 1) => ({ v, rs, cs });
const grid = (rows: unknown[][], cols: number) => ({ rows, cols });

/* ── cells: shape ──────────────────────────────────────────────────────── */

test("accepts the shape the editor actually sends", () => {
  const result = validateCells(grid([[cell(""), cell("a"), null]], 3));
  assert.equal(result.ok, true);
});

test("rejects a non-object cells payload", () => {
  for (const bad of [null, undefined, "nope", 42]) {
    assert.equal(validateCells(bad).ok, false);
  }
});

test("rejects rows/cols of the wrong type", () => {
  assert.equal(validateCells({ rows: "x", cols: 1 }).ok, false);
  assert.equal(validateCells({ rows: [], cols: "1" }).ok, false);
});

/* ── cells: the unbounded-width gap the old check missed ──────────────── */

test("rejects a row wider than the grid limit even when rows.length is small", () => {
  // The exact shape that slipped through before: ONE row, cols within limits,
  // but the row itself holds far more cells than the grid allows.
  const fatRow = Array.from({ length: MAX_GRID_SIZE + 1 }, () => cell(""));
  const result = validateCells(grid([fatRow], 1));
  assert.equal(result.ok, false);
});

test("rejects a cell whose text is unbounded", () => {
  const huge = "A".repeat(MAX_CELL_TEXT + 1);
  const result = validateCells(grid([[cell(huge)]], 1));
  assert.equal(result.ok, false, "an oversized cell must not be accepted");
});

test("accepts a cell of exactly the maximum length", () => {
  const exact = "A".repeat(MAX_CELL_TEXT);
  assert.equal(validateCells(grid([[cell(exact)]], 1)).ok, true);
});

test("rejects a non-string cell value", () => {
  assert.equal(validateCells(grid([[{ v: 42, rs: 1, cs: 1 }]], 1)).ok, false);
});

test("rejects a null row entry only when it is not a covered cell", () => {
  // null IS legitimate — it marks a cell covered by a merge.
  assert.equal(isValidCell(null), true);
  assert.equal(isValidCell(undefined), false);
  assert.equal(isValidCell(0), false);
});

/* ── cells: merge spans must not corrupt the render path ──────────────── */

test("rejects a zero or negative span that would break the merge engine", () => {
  for (const bad of [cell("x", 0, 1), cell("x", 1, 0), cell("x", -2, -2)]) {
    assert.equal(validateCells(grid([[bad]], 1)).ok, false);
  }
});

test("rejects a span beyond the grid limit", () => {
  const bad = cell("x", MAX_GRID_SIZE + 1, 1);
  assert.equal(validateCells(grid([[bad]], 1)).ok, false);
});

test("rejects a non-integer span", () => {
  assert.equal(validateCells(grid([[cell("x", 1.5, 1)]], 1)).ok, false);
  assert.equal(validateCells(grid([[cell("x", Number.NaN, 1)]], 1)).ok, false);
});

/* ── cells: outer dimensions still hold ────────────────────────────────── */

test("still rejects too many rows or cols", () => {
  const manyRows = Array.from({ length: MAX_GRID_SIZE + 1 }, () => [cell("")]);
  assert.equal(validateCells(grid(manyRows, 1)).ok, false);
  assert.equal(validateCells(grid([[cell("")]], MAX_GRID_SIZE + 1)).ok, false);
});

test("rejects a total document over the serialized ceiling", () => {
  // Many legal cells that together exceed the ceiling.
  const wide = 200;
  const text = "A".repeat(MAX_CELL_TEXT);
  const rows = Array.from({ length: 200 }, () =>
    Array.from({ length: wide }, () => cell(text)),
  );
  const result = validateCells(grid(rows, wide));
  assert.equal(result.ok, false);
  assert.match(
    result.ok ? "" : result.error,
    /too large/i,
    "an over-sized document must report the size error, not a shape error",
  );
});

test("a large but realistic table of legal cells still saves", () => {
  // Guards against the bounds being set so low that real use is blocked: a
  // 40x40 table where every cell holds maximum-length text is ~3.2 MB and must
  // be accepted.
  const text = "A".repeat(MAX_CELL_TEXT);
  const rows = Array.from({ length: 40 }, () =>
    Array.from({ length: 40 }, () => cell(text)),
  );
  const result = validateCells(grid(rows, 40));
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.serialized.length <= MAX_SERIALIZED_BYTES);
});

/* ── stickers ─────────────────────────────────────────────────────────── */

test("accepts stickers in the editor's shape", () => {
  const sticker = { id: "abc", sprite: "happy", x: 50, y: 40, w: 64 };
  const result = validateStickers([sticker]);
  assert.equal(result.ok, true);
});

test("rejects a non-array stickers payload", () => {
  assert.equal(validateStickers({ id: "a" }).ok, false);
  assert.equal(validateStickers(null).ok, false);
});

test("rejects an unbounded sticker array", () => {
  const many = Array.from({ length: MAX_STICKERS + 1 }, (_, i) => ({
    id: `s${i}`,
    sprite: "happy",
  }));
  const result = validateStickers(many);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /too many stickers/i);
});

test("rejects megabytes of text hidden inside one sticker", () => {
  // The shape that slipped through before: a valid-looking array of one
  // element carrying a huge unknown field. `id`/`sprite` are individually
  // bounded; the total serialized ceiling is what stops the rest.
  const bomb = [{ id: "a", sprite: "happy", junk: "A".repeat(5_000_000) }];
  const result = validateStickers(bomb);
  assert.equal(result.ok, false);
  assert.ok(JSON.stringify(bomb).length > MAX_SERIALIZED_BYTES);
});

test("rejects a sticker missing identity fields", () => {
  assert.equal(validateStickers([{ sprite: "happy" }]).ok, false);
  assert.equal(validateStickers([{ id: "a" }]).ok, false);
  assert.equal(validateStickers([{ id: "", sprite: "happy" }]).ok, false);
  assert.equal(validateStickers([{ id: "a", sprite: "" }]).ok, false);
});

test("rejects an over-long sticker id or sprite", () => {
  assert.equal(validateSticker({ id: "x".repeat(65), sprite: "s", x: 50, y: 50 }), null);
  assert.equal(validateSticker({ id: "a", sprite: "x".repeat(65), x: 50, y: 50 }), null);
});

test("rejects non-object sticker entries", () => {
  for (const bad of [null, undefined, "sticker", 5, []]) {
    assert.equal(validateSticker(bad), null);
  }
});

/* ── cells: dimensions the editor always produces ─────────────────────────── */

test("rejects a column count that is not a positive integer", () => {
  /* `NaN > MAX_GRID_SIZE` is false, so a bare `typeof === "number"` check let
     these through. The rows here are sized to MATCH the bogus `cols` (an empty
     row for cols 0), so only the column-count check itself can reject them —
     otherwise the row-width check would mask a regression here. */
  for (const cols of [NaN, Infinity, -Infinity, -1, 0, 1.5, "3", null, undefined]) {
    const rows = cols === 0 ? [[]] : [[cell("")]];
    const result = validateCells(grid(rows, cols as unknown as number));
    assert.equal(result.ok, false, `cols=${String(cols)} was accepted`);
    assert.match(
      (result as { ok: false; error: string }).error,
      /column count|no rows/i,
      `cols=${String(cols)} was rejected by the wrong check`,
    );
  }
});

test("rejects a grid with no rows", () => {
  assert.equal(validateCells(grid([], 3)).ok, false);
});

test("rejects rows whose width disagrees with cols", () => {
  // Ragged rows used to pass, leaving the stored table disagreeing with itself.
  assert.equal(validateCells(grid([[cell("a"), cell("b")]], 3)).ok, false, "short row accepted");
  assert.equal(validateCells(grid([[cell("a"), cell("b"), cell("c"), cell("d")]], 3)).ok, false,
    "long row accepted");
  assert.equal(validateCells(grid([[cell("a")], [cell("b"), cell("c")]], 2)).ok, false,
    "ragged grid accepted");
});

test("accepts a consistent grid", () => {
  assert.equal(validateCells(grid([[cell("a"), null], [null, cell("b")]], 2)).ok, true);
});

/* ── stickers: every field, because they reach the PDF export ─────────────── */

const sticker = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  sprite: "happy",
  x: 50,
  y: 50,
  ...over,
});

test("rejects sticker positions outside 0-100 or non-finite", () => {
  for (const over of [{ x: -1 }, { x: 101 }, { y: -0.5 }, { y: 100.5 }, { x: NaN }, { y: Infinity }]) {
    assert.equal(validateSticker(sticker(over)), null, `${JSON.stringify(over)} accepted`);
  }
});

test("rejects a sticker width outside the resizable range", () => {
  for (const w of [0, 39, 241, NaN, -100]) {
    assert.equal(validateSticker(sticker({ w })), null, `w=${w} accepted`);
  }
  assert.ok(validateSticker(sticker({ w: 40 })));
  assert.ok(validateSticker(sticker({ w: 240 })));
  assert.ok(validateSticker(sticker({ w: 88 })));
});

test("rejects non-boolean flags and unknown sticker states", () => {
  assert.equal(validateSticker(sticker({ locked: "yes" })), null);
  assert.equal(validateSticker(sticker({ mirrored: 1 })), null);
  assert.equal(validateSticker(sticker({ state: "dancing" })), null);
  assert.ok(validateSticker(sticker({ state: "pause" })));
  assert.ok(validateSticker(sticker({ state: "frame2" })));
});

test("rejects a sprite that could escape the asset path or the src attribute", () => {
  // The PDF export writes `/rina/${sprite}.webp` into a quoted attribute of a
  // same-origin iframe, so quotes/slashes here are an XSS and a traversal.
  for (const sprite of [
    'x" onerror="alert(1)',
    "../../etc/passwd",
    "rina/happy",
    "a b",
    "a\tb",
    "<script>",
  ]) {
    assert.equal(validateSticker(sticker({ sprite })), null, `sprite=${sprite} accepted`);
  }
});

test("drops unknown sticker keys instead of persisting them", () => {
  const result = validateStickers([
    { ...sticker(), junk: "A".repeat(1000), __proto__: { polluted: true } },
  ]);
  assert.equal(result.ok, true);
  const stored = JSON.parse((result as { ok: true; value: string }).value)[0];
  assert.deepEqual(Object.keys(stored).sort(), ["id", "sprite", "x", "y"]);
});

test("a sticker payload is stored in normalized form", () => {
  const result = validateStickers([
    { id: "s1", sprite: "happy", x: 10, y: 20, w: 88, locked: false, mirrored: true, state: "play" },
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse((result as { ok: true; value: string }).value), [
    { id: "s1", sprite: "happy", x: 10, y: 20, w: 88, locked: false, mirrored: true, state: "play" },
  ]);
});
