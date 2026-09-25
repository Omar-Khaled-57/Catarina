import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMON_PASSWORDS,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN,
  decidePassword,
  isCommonPassword,
} from "./passwordPolicy";

test("the length floor is 8, not 6", () => {
  assert.equal(PASSWORD_MIN_LEN, 8);
});

test("a 7-character password is rejected", () => {
  const result = decidePassword("abcdefg");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /at least 8/);
});

test("a 6-character password is rejected (the old floor)", () => {
  assert.equal(decidePassword("abcdef").ok, false);
});

test("an 8-character non-common password is accepted", () => {
  const result = decidePassword("correct horse");
  assert.equal(result.ok, true);
  assert.equal(result.ok === true ? result.password : "", "correct horse");
});

test("a multi-word passphrase needs no character classes", () => {
  // No upper, no digit, no symbol: the policy deliberately permits this.
  const result = decidePassword("otterrainlamps");
  assert.equal(result.ok, true);
});

test("a single lowercase dictionary word of sufficient length is accepted", () => {
  // Only the blocklist and length gates apply; we are not scoring strength.
  assert.equal(decidePassword("pineapple").ok, true);
});

test("missing and non-string values are rejected", () => {
  assert.equal(decidePassword(undefined).ok, false);
  assert.equal(decidePassword(null).ok, false);
  assert.equal(decidePassword(12345678).ok, false);
  assert.equal(decidePassword("").ok, false);
});

test("an over-long password is rejected", () => {
  assert.equal(decidePassword("a".repeat(PASSWORD_MAX_LEN + 1)).ok, false);
});

test("the 72-byte cap is the binding upper bound, not the 200-char cap", () => {
  // 72 bytes < 200 characters, so no password can ever reach the character cap:
  // the byte check always rejects first. This test pins that real behaviour.
  assert.ok(PASSWORD_MAX_BYTES < PASSWORD_MAX_LEN);
  const result = decidePassword("a".repeat(PASSWORD_MAX_LEN));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /72 bytes/);
});

test("a password at exactly 72 bytes is accepted", () => {
  assert.equal(decidePassword("a".repeat(PASSWORD_MAX_BYTES)).ok, true);
});

test("a password one byte over the cap is rejected", () => {
  assert.equal(decidePassword("a".repeat(PASSWORD_MAX_BYTES + 1)).ok, false);
});

test("the bcrypt 72-byte cap is enforced, not silently truncated", () => {
  // 40 multi-byte characters is 120 UTF-8 bytes but only 40 characters.
  const tooManyBytes = "é".repeat(PASSWORD_MAX_BYTES / 2 + 1);
  const result = decidePassword(tooManyBytes);
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /72 bytes/);
});

test("the most common breached passwords are blocked", () => {
  for (const pw of [
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "qwerty123",
    "letmein123",
    "iloveyou1",
    "admin1234",
    "welcome123",
  ]) {
    assert.equal(decidePassword(pw).ok, false, `${pw} must be rejected`);
  }
});

test("blocking is case-insensitive and ignores surrounding whitespace", () => {
  assert.equal(isCommonPassword("PASSWORD"), true);
  assert.equal(isCommonPassword("Password123"), true);
  assert.equal(isCommonPassword("  password1  "), true);
});

test("a strong password is not caught by the blocklist", () => {
  assert.equal(isCommonPassword("otterrainlamps"), false);
  assert.equal(decidePassword("9Zt!mQv2#Lx").ok, true);
});

test("the blocklist has no duplicate or empty entries", () => {
  assert.ok(COMMON_PASSWORDS.size > 0);
  for (const entry of COMMON_PASSWORDS) {
    assert.ok(entry.length > 0);
    assert.equal(entry, entry.trim().toLowerCase());
  }
});

test("the common-password message is actionable but reveals nothing", () => {
  const result = decidePassword("password123");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /too common/i);
});
