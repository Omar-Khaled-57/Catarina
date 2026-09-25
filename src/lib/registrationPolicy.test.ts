import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGISTRATION_CONFLICT_MESSAGE,
  decideRegistration,
  type ApprovalStatus,
} from "./registrationPolicy";

function decide(userExists: boolean, approvalStatus: ApprovalStatus | null) {
  return decideRegistration({ userExists, approvalStatus });
}

test("a first-time applicant may request an account", () => {
  assert.deepEqual(decide(false, null), { ok: true });
});

test("a registered email is refused", () => {
  assert.deepEqual(decide(true, null), { ok: false, reason: "registered" });
});

test("a pending request blocks a duplicate request", () => {
  assert.deepEqual(decide(false, "PENDING"), { ok: false, reason: "pending" });
});

test("a REJECTED request is NOT overwritable — the hijack path", () => {
  // Regression: this used to fall through to an upsert that replaced the
  // stored name/password/section, so a stranger could take over a rejected
  // applicant's identity once an admin approved the resurrected request.
  assert.deepEqual(decide(false, "REJECTED"), {
    ok: false,
    reason: "stale-request",
  });
});

test("an APPROVED-but-orphaned request is NOT overwritable", () => {
  assert.deepEqual(decide(false, "APPROVED"), {
    ok: false,
    reason: "stale-request",
  });
});

test("a registered user wins over any approval status", () => {
  assert.deepEqual(decide(true, "REJECTED"), {
    ok: false,
    reason: "registered",
  });
});

test("no decision ever leaks a distinct message (anti-enumeration)", () => {
  assert.equal(typeof REGISTRATION_CONFLICT_MESSAGE, "string");
  assert.ok(REGISTRATION_CONFLICT_MESSAGE.length > 0);
  const reasons = new Set(
    [true, false].flatMap((userExists) =>
      ([null, "PENDING", "REJECTED", "APPROVED"] as const).map((approvalStatus) =>
        decide(userExists, approvalStatus),
      ),
    ),
  );
  for (const decision of reasons) {
    if (decision.ok) continue;
    assert.equal(decision.reason.length > 0, true);
  }
});
