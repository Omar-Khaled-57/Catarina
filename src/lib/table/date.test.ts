import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseDateCell, detectDateAxis, parseDayOfWeek, todayIndex } from "@/lib/table/date";

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

/* ─── parseDayOfWeek ──────────────────────────────────────────────────────── */

describe("parseDayOfWeek", () => {
  test("parses full and abbreviated English names", () => {
    assert.equal(parseDayOfWeek("sun"), 0);
    assert.equal(parseDayOfWeek("Sunday"), 0);
    assert.equal(parseDayOfWeek("MONDAY"), 1);
    assert.equal(parseDayOfWeek(" wed "), 3);
    assert.equal(parseDayOfWeek("Sat"), 6);
  });

  test("returns null for anything that is not exactly a day name", () => {
    assert.equal(parseDayOfWeek(""), null);
    assert.equal(parseDayOfWeek("Task"), null);
    // A substring search would read these as Monday / Tuesday.
    assert.equal(parseDayOfWeek("Common tasks"), null);
    assert.equal(parseDayOfWeek("Tuesday notes"), null);
    assert.equal(parseDayOfWeek("2026-09-01"), null);
  });
});

/* ─── detectDateAxis ─────────────────────────────────────────────────────── */

describe("detectDateAxis", () => {
  test("detects a day-name header as a column axis", () => {
    const rows = [["Mon", "Tue", "Wed", "Thu", "Fri"]];
    assert.equal(detectDateAxis(rows, 5), "cols");
  });

  test("detects a day-name first column as a row axis", () => {
    const rows = [
      ["Day", "Owner", "Task"],
      ["Mon", "Reem", "Prep"],
      ["Tue", "Ali", "Build"],
      ["Wed", "Yara", "Ship"],
    ];
    assert.equal(detectDateAxis(rows, 3), "rows");
  });

  test("an ordinary header is still not a date axis", () => {
    const rows = [["Task", "Owner", "Monday notes", "Due"]];
    assert.equal(detectDateAxis(rows, 4), null);
  });

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

  test("a single date-like cell does not declare an axis", () => {
    // The ratio alone is 1.0 here, which used to flag the axis and highlight
    // the wrong column as "today".
    assert.equal(detectDateAxis([["2026-09-01"]], 1), null);
    assert.equal(detectDateAxis([["2026-09-01", "Owner"]], 2), null);
    assert.equal(detectDateAxis([["Mon"]], 1), null);
    assert.equal(
      detectDateAxis([["Task", "2026-09-01"], ["a", "b"], ["c", "d"]], 2),
      null,
      "one date among many non-dates is not an axis",
    );
  });

  test("two or more dates still declare an axis", () => {
    assert.equal(detectDateAxis([["2026-09-01", "2026-09-02"]], 2), "cols");
    assert.equal(detectDateAxis([["Mon", "Tue"]], 2), "cols");
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
