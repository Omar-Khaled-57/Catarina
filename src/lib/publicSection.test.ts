import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_SECTION_FIELDS,
  toPublicSection,
  toPublicSections,
  type SectionRow,
} from "./publicSection";

const ROW: SectionRow = {
  id: "cm123secretid",
  key: "MARKETING",
  label: "Marketing",
  prefix: "MRK-",
  color: "#FF4D6A",
  sortOrder: 7,
  isActive: true,
};

test("the public projection exposes exactly the four display fields", () => {
  assert.deepEqual(Object.keys(toPublicSection(ROW)).sort(), [...PUBLIC_SECTION_FIELDS].sort());
});

test("no internal identifier or admin metadata leaks to anonymous callers", () => {
  const out = JSON.stringify(toPublicSection(ROW));
  assert.ok(!out.includes("cm123secretid"), "primary key must not be exposed");
  assert.ok(!("sortOrder" in toPublicSection(ROW)), "sortOrder must not be exposed");
  assert.ok(!("isActive" in toPublicSection(ROW)), "isActive must not be exposed");
});

test("a row carrying extra future columns cannot widen the public shape", () => {
  const widened = { ...ROW, internalCost: 99, deletedAt: "2026-01-01" } as unknown as SectionRow;
  assert.deepEqual(Object.keys(toPublicSection(widened)).sort(), [...PUBLIC_SECTION_FIELDS].sort());
});

test("field values pass through unchanged", () => {
  assert.deepEqual(toPublicSection(ROW), {
    key: "MARKETING",
    label: "Marketing",
    color: "#FF4D6A",
    prefix: "MRK-",
  });
});

test("a list projects every row and preserves order", () => {
  const rows: SectionRow[] = [
    ROW,
    { ...ROW, id: "b", key: "ART", label: "Art", sortOrder: 1 },
  ];
  const out = toPublicSections(rows);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((s) => s.key), ["MARKETING", "ART"]);
});

test("an empty list projects to an empty list", () => {
  assert.deepEqual(toPublicSections([]), []);
});
