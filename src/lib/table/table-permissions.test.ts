import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canReadTable,
  canWriteTable,
  canManageStickers,
  type TableCtx,
} from "@/lib/table/table-permissions";
import { DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } from "@/lib/permissions";

const table = { section: "ART" };

const adminCtx: TableCtx = {
  role: "ADMIN",
  sections: [],
  permissions: ADMIN_PERMISSIONS,
};

const memberWithPerm: TableCtx = {
  role: "MEMBER",
  sections: ["ART"],
  permissions: { ...DEFAULT_PERMISSIONS, canManageTables: true },
};

const memberNoPerm: TableCtx = {
  role: "MEMBER",
  sections: ["ART"],
  permissions: { ...DEFAULT_PERMISSIONS, canManageTables: false },
};

const memberWrongSection: TableCtx = {
  role: "MEMBER",
  sections: ["MARKETING"],
  permissions: { ...DEFAULT_PERMISSIONS, canManageTables: true },
};

/* ─── canReadTable ───────────────────────────────────────────────────────── */

describe("canReadTable", () => {
  test("admin can read any table", () => {
    assert.equal(canReadTable(adminCtx, table), true);
  });

  test("member in section can read", () => {
    assert.equal(canReadTable(memberWithPerm, table), true);
  });

  test("member without permission can still read", () => {
    assert.equal(canReadTable(memberNoPerm, table), true);
  });

  test("member in wrong section cannot read", () => {
    assert.equal(canReadTable(memberWrongSection, table), false);
  });
});

/* ─── canWriteTable ──────────────────────────────────────────────────────── */

describe("canWriteTable", () => {
  test("admin can always write", () => {
    assert.equal(canWriteTable(adminCtx, table), true);
  });

  test("member with canManageTables + correct section can write", () => {
    assert.equal(canWriteTable(memberWithPerm, table), true);
  });

  test("member without canManageTables cannot write", () => {
    assert.equal(canWriteTable(memberNoPerm, table), false);
  });

  test("member in wrong section cannot write even with flag", () => {
    assert.equal(canWriteTable(memberWrongSection, table), false);
  });
});

/* ─── canManageStickers ──────────────────────────────────────────────────── */

describe("canManageStickers", () => {
  test("mirrors canWriteTable", () => {
    assert.equal(canManageStickers(adminCtx, table), canWriteTable(adminCtx, table));
    assert.equal(
      canManageStickers(memberWithPerm, table),
      canWriteTable(memberWithPerm, table),
    );
    assert.equal(
      canManageStickers(memberNoPerm, table),
      canWriteTable(memberNoPerm, table),
    );
  });
});
