import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cn,
  calcPercentage,
  calcSectionStats,
  deadlineStatus,
  monthName,
  monthNameLine1,
  monthNameLine2,
  formatDate,
} from "@/lib/utils";

describe("cn", () => {
  test("merges and dedupes class names", () => {
    assert.equal(cn("a", "b"), "a b");
    assert.equal(cn("a", false && "b", null, undefined, "c"), "a c");
  });
});

describe("calcPercentage", () => {
  test("clamps between 0 and 100", () => {
    assert.equal(calcPercentage(0, 10), 0);
    assert.equal(calcPercentage(5, 10), 50);
    assert.equal(calcPercentage(20, 10), 100);
    assert.equal(calcPercentage(5, 0), 0);
  });
});

describe("calcSectionStats", () => {
  test("computes totals, done, remaining, and percentage", () => {
    const stats = calcSectionStats([
      { done: true, current: 1, target: 1 },
      { done: false, current: 0, target: 1 },
      { done: true, current: 2, target: 5 },
      { done: false, current: 0, target: 1 },
    ]);
    assert.deepEqual(stats, { total: 4, done: 2, remaining: 2, percentage: 50 });
  });

  test("handles empty list", () => {
    assert.deepEqual(calcSectionStats([]), { total: 0, done: 0, remaining: 0, percentage: 0 });
  });
});

describe("deadlineStatus", () => {
  test("done goals are always normal", () => {
    assert.equal(deadlineStatus(new Date(Date.now() - 100000), true), "normal");
  });

  test("past deadline without done is overdue", () => {
    assert.equal(deadlineStatus(new Date(Date.now() - 100000), false), "overdue");
  });

  test("deadline within 3 days is urgent", () => {
    assert.equal(deadlineStatus(new Date(Date.now() + 2 * 86400000), false), "urgent");
  });

  test("deadline far out is normal", () => {
    assert.equal(deadlineStatus(new Date(Date.now() + 10 * 86400000), false), "normal");
  });
});

describe("month naming", () => {
  test("monthNameLine1 formats full month and year", () => {
    assert.equal(monthNameLine1(7, 2026), "July / 2026");
  });

  test("monthNameLine2 formats padded month", () => {
    assert.equal(monthNameLine2(7), "month - 07");
  });

  test("monthName combines both lines", () => {
    assert.equal(monthName(7, 2026), "July / 2026\nmonth - 07");
  });
});

describe("formatDate", () => {
  test("formats dd/mm/yy", () => {
    assert.equal(formatDate("2026-07-31T12:00:00Z"), "31/07/26");
  });
});
