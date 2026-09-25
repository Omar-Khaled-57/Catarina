import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DUMMY_PASSWORD_HASH,
  LOGIN_FAILURE_MESSAGE,
  verifyLoginPassword,
  type PasswordComparator,
} from "./loginPolicy";

/** Records every comparison so we can assert the WORK happened, not the clock. */
function recordingComparator(result = false) {
  const calls: { password: string; hash: string }[] = [];
  const compare: PasswordComparator = async (password, hash) => {
    calls.push({ password, hash });
    return result;
  };
  return { compare, calls };
}

const REAL_HASH = "$2b$12$abcdefghijklmnopqrstuv";

test("an unknown account still performs a comparison (the timing fix)", () => {
  const { compare, calls } = recordingComparator(true);
  return verifyLoginPassword("guess", null, compare).then((ok) => {
    assert.equal(ok, false, "an unknown account must never authenticate");
    assert.equal(calls.length, 1, "no short-circuit: the work must still happen");
    assert.equal(calls[0].hash, DUMMY_PASSWORD_HASH);
  });
});

test("an unknown account and a wrong password do identical work", () => {
  const unknown = recordingComparator(false);
  const wrong = recordingComparator(false);
  return Promise.all([
    verifyLoginPassword("same-password", null, unknown.compare),
    verifyLoginPassword("same-password", REAL_HASH, wrong.compare),
  ]).then(([a, b]) => {
    assert.equal(a, false);
    assert.equal(b, false);
    assert.equal(unknown.calls.length, wrong.calls.length);
    /* Only the hash differs — the comparator is invoked exactly the same way. */
    assert.equal(unknown.calls[0].password, wrong.calls[0].password);
  });
});

test("a correct password against a real hash authenticates", () => {
  const { compare, calls } = recordingComparator(true);
  return verifyLoginPassword("correct horse", REAL_HASH, compare).then((ok) => {
    assert.equal(ok, true);
    assert.equal(calls[0].hash, REAL_HASH);
  });
});

test("a wrong password against a real hash is rejected", () => {
  const { compare } = recordingComparator(false);
  return verifyLoginPassword("nope", REAL_HASH, compare).then((ok) => {
    assert.equal(ok, false);
  });
});

test("an unknown account cannot be made to pass by a comparator returning true", () => {
  // The dummy path must be false even if the comparison itself "succeeds".
  const { compare } = recordingComparator(true);
  return verifyLoginPassword("anything", null, compare).then((ok) => {
    assert.equal(ok, false);
  });
});

test("a throwing comparator fails closed", () => {
  const compare: PasswordComparator = async () => {
    throw new Error("corrupt stored hash");
  };
  return verifyLoginPassword("guess", REAL_HASH, compare).then((ok) => {
    assert.equal(ok, false);
  });
});

test("the dummy hash is a real cost-12 bcrypt hash, not a placeholder", () => {
  assert.match(DUMMY_PASSWORD_HASH, /^\$2[aby]\$12\$/);
  assert.equal(DUMMY_PASSWORD_HASH.length, 60);
});

test("there is exactly one failure message", () => {
  assert.equal(LOGIN_FAILURE_MESSAGE, "Invalid email or password");
});
