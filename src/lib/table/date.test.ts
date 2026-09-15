import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseDateCell, detectDateAxis, todayIndex } from "@/lib/table/date";

/* ─── parseDateCell ──────────────────────────────────────────────────────── */

describe("parseDateCell", () => {
  test("parses a valid YYYY-MM-DD string", () => {
    const d = parseDateCell("2026-09-15");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8); // 0-indexed
    assert.equal(d.getDate(), 15);
  });

  test("returns null for empty string", () => {
    assert.equal(parseDateCell(""), null);
  });

  test("returns null for non-date text", () => {
    assert.equal(parseDateCell("hello"), null);
    assert.equal(parseDateCell("12/13/2026"), null);
  });

  test("returns null for invalid dates like 2026-02-30", () => {
    assert.equal(parseDateCell("2026-02-30"), null);
  });

  test("trims whitespace", () => {
    const d = parseDateCell("  2026-01-01  ");
    assert.ok(d);
    assert.equal(d.getDate(), 1);
  });
});

/* ─── detectDateAxis ─────────────────────────────────────────────────────── */

describe("detectDateAxis", () => {
  test("detects column dates in header row", () => {
    const rows = [["2026-09-01", "2026-09-02", "2026-09-03"]];
    assert.equal(detectDateAxis(rows, 3), "cols");
  });

  test("detects row dates in first column", () => {
    const rows = [
      ["Label", "val"],
      ["2026-09-01", "a"],
      ["2026-09-02", "b"],
    ];
    assert.equal(detectDateAxis(rows, 2), "rows");
  });

  test("returns null when no dates found", () => {
    const rows = [["foo", "bar"], ["baz", "qux"]];
    assert.equal(detectDateAxis(rows, 2), null);
  });

  test("returns null on empty grid", () => {
    assert.equal(detectDateAxis([], 0), null);
  });

  test("prefers header row over first column when both are dates", () => {
    const rows = [
      ["2026-09-01", "2026-09-02"],
      ["2026-09-03", "data"],
    ];
    assert.equal(detectDateAxis(rows, 2), "cols");
  });
});

/* ─── todayIndex ─────────────────────────────────────────────────────────── */

describe("todayIndex", () => {
  test("finds today's column", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const rows = [[iso, "other"]];
    assert.equal(todayIndex(rows, 2, "cols"), 0);
  });

  test("returns -1 when today is not in the axis", () => {
    const rows = [["2020-01-01", "2020-01-02"]];
    assert.equal(todayIndex(rows, 2, "cols"), -1);
  });

  test("returns -1 when axis is null", () => {
    assert.equal(todayIndex([["foo"]], 1, null), -1);
  });

  test("finds today's row", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const rows = [
      ["Label", "val"],
      ["2020-01-01", "a"],
      [iso, "b"],
    ];
    assert.equal(todayIndex(rows, 2, "rows"), 2);
  });
});
