import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parsePermissions,
  resolvePermissions,
  serializePermissions,
  DEFAULT_PERMISSIONS,
  ADMIN_PERMISSIONS,
} from "@/lib/permissions";

describe("parsePermissions", () => {
  test("falls back to defaults on null/undefined", () => {
    assert.deepEqual(parsePermissions(null), DEFAULT_PERMISSIONS);
    assert.deepEqual(parsePermissions(undefined), DEFAULT_PERMISSIONS);
  });

  test("falls back to defaults on invalid JSON", () => {
    assert.deepEqual(parsePermissions("not-json{"), DEFAULT_PERMISSIONS);
  });

  test("merges partial JSON over defaults", () => {
    const parsed = parsePermissions(JSON.stringify({ canEditGoals: true }));
    assert.equal(parsed.canEditGoals, true);
    assert.equal(parsed.canCreateGoals, DEFAULT_PERMISSIONS.canCreateGoals);
    assert.equal(parsed.canDeleteGoals, false);
  });

  test("round-trips through serializePermissions", () => {
    const perms = { ...DEFAULT_PERMISSIONS, canManageMembers: true };
    assert.deepEqual(parsePermissions(serializePermissions(perms)), perms);
  });
});

describe("resolvePermissions", () => {
  test("admin always gets the full set regardless of raw value", () => {
    assert.deepEqual(resolvePermissions("ADMIN", null), ADMIN_PERMISSIONS);
    assert.deepEqual(resolvePermissions("ADMIN", "not-json"), ADMIN_PERMISSIONS);
  });

  test("members get parsed flags", () => {
    assert.deepEqual(resolvePermissions("MEMBER", null), DEFAULT_PERMISSIONS);
    const parsed = resolvePermissions("MEMBER", JSON.stringify({ canEditGoals: true }));
    assert.equal(parsed.canEditGoals, true);
    assert.equal(parsed.canManageMembers, false);
  });
});
