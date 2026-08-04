import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeGoals, mergeGoalsDedupeTemp, type Mergeable } from "@/lib/mergeGoals";

const mk = (id: string, updatedAt: string): Mergeable => ({ id, updatedAt });

describe("mergeGoals", () => {
  test("returns the same array reference when delta is empty", () => {
    const current = [mk("a", "1")];
    assert.equal(mergeGoals(current, []), current);
    assert.equal(mergeGoals(current, null as unknown as Mergeable[]), current);
  });

  test("returns the same array reference when nothing changed", () => {
    const current = [mk("a", "1")];
    const merged = mergeGoals(current, [mk("a", "1")]);
    assert.equal(merged, current);
  });

  test("appends genuinely new items preserving existing order", () => {
    const current = [mk("a", "1"), mk("b", "1")];
    const merged = mergeGoals(current, [mk("c", "1")]);
    assert.deepEqual(merged.map((g) => g.id), ["a", "b", "c"]);
  });

  test("replaces existing items when updatedAt differs", () => {
    const current = [mk("a", "1"), mk("b", "1")];
    const merged = mergeGoals(current, [mk("b", "2")]);
    assert.deepEqual(merged.map((g) => g.id), ["a", "b"]);
    assert.equal(merged[1].updatedAt, "2");
  });

  test("handles a mixed delta of new + changed items without dropping either", () => {
    const current = [mk("a", "1")];
    const merged = mergeGoals(current, [mk("a", "2"), mk("b", "1")]);
    assert.deepEqual(merged.map((g) => g.id).sort(), ["a", "b"]);
    assert.equal(merged.find((g) => g.id === "a")?.updatedAt, "2");
  });

  test("treats a Date updatedAt vs its ISO string as changed (string coercion differs)", () => {
    const current = [mk("a", "2026-01-01T00:00:00.000Z")];
    const merged = mergeGoals(current, [{ id: "a", updatedAt: new Date("2026-01-01T00:00:00.000Z") }]);
    assert.notEqual(merged, current);
  });

  test("keeps delta objects as-is (full delta type merged into narrower state type)", () => {
    const current: { id: string; updatedAt: string }[] = [{ id: "a", updatedAt: "1" }];
    const delta = [{ id: "a", updatedAt: "2", extra: true }];
    const merged = mergeGoals(current, delta);
    assert.equal((merged[0] as unknown as { extra: boolean }).extra, true);
  });
});

describe("mergeGoalsDedupeTemp", () => {
  const tempGoal = {
    id: "temp-abcd1234",
    name: "Launch campaign",
    section: "MARKETING",
    monthId: "m1",
    updatedAt: "t0",
  };
  const realGoal = {
    id: "real-goal-1",
    name: "Launch campaign",
    section: "MARKETING",
    monthId: "m1",
    updatedAt: "t1",
  };

  test("replaces a matching temp goal with its real twin (no duplicate)", () => {
    const merged = mergeGoalsDedupeTemp([tempGoal], [realGoal]);
    assert.deepEqual(merged.map((g) => g.id), ["real-goal-1"]);
    assert.equal(merged.length, 1);
  });

  test("leaves unrelated temp goals alone when delta doesn't match", () => {
    const other = { ...tempGoal, name: "Other goal" };
    const merged = mergeGoalsDedupeTemp([tempGoal], [other]);
    assert.deepEqual(merged.map((g) => g.id), ["temp-abcd1234"]);
  });

  test("still merges unrelated deltas alongside a replacement", () => {
    const unrelated = {
      id: "real-goal-2",
      name: "Different goal",
      section: "MARKETING",
      monthId: "m1",
      updatedAt: "t1",
    };
    const merged = mergeGoalsDedupeTemp([tempGoal], [realGoal, unrelated]);
    assert.deepEqual(merged.map((g) => g.id).sort(), ["real-goal-1", "real-goal-2"]);
    assert.equal(merged.filter((g) => g.id.startsWith("temp-")).length, 0);
  });

  test("replaces the same real goal again when updatedAt differs (upsert still works)", () => {
    const merged1 = mergeGoalsDedupeTemp([tempGoal], [realGoal]);
    const merged2 = mergeGoalsDedupeTemp(merged1, [{ ...realGoal, updatedAt: "t2" }]);
    assert.deepEqual(merged2.map((g) => g.id), ["real-goal-1"]);
    assert.equal((merged2[0] as { updatedAt: string }).updatedAt, "t2");
  });

  test("returns the original array when delta is empty", () => {
    const current = [tempGoal];
    assert.equal(mergeGoalsDedupeTemp(current, []), current);
  });
});
