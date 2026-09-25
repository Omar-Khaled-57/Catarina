import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFRESH_TOKEN_TTL_MS,
  decideRefresh,
  isValidRefreshTokenShape,
  nextExpiry,
} from "./refreshPolicy";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 1000);
const PAST = new Date(NOW.getTime() - 1000);

function facts(over: Partial<Parameters<typeof decideRefresh>[0]> = {}) {
  return { revoked: false, usedAt: null, expiresAt: FUTURE, hasUser: true, ...over };
}

test("accepts a live, unused token", () => {
  assert.equal(decideRefresh(facts(), NOW), "accept");
});

test("rejects an unknown token (fail closed)", () => {
  assert.equal(decideRefresh(null, NOW), "reject");
});

test("rejects a revoked token", () => {
  assert.equal(decideRefresh(facts({ revoked: true }), NOW), "reject");
});

test("rejects an orphaned token whose user no longer exists", () => {
  assert.equal(decideRefresh(facts({ hasUser: false }), NOW), "reject");
});

test("rejects an expired token", () => {
  assert.equal(decideRefresh(facts({ expiresAt: PAST }), NOW), "reject");
});

test("treats an exactly-now expiry as expired (boundary, not a free extra use)", () => {
  assert.equal(decideRefresh(facts({ expiresAt: NOW }), NOW), "reject");
});

test("flags a spent (rotated-away) token as reuse so the family is revoked", () => {
  assert.equal(decideRefresh(facts({ usedAt: PAST }), NOW), "reuse");
});

test("a replayed spent token is reuse even when the row is also expired", () => {
  assert.equal(decideRefresh(facts({ usedAt: PAST, expiresAt: PAST }), NOW), "reuse");
});

test("token shape validation rejects short, long, and non-string values", () => {
  assert.equal(isValidRefreshTokenShape("a".repeat(64)), true);
  assert.equal(isValidRefreshTokenShape("a".repeat(31)), false);
  assert.equal(isValidRefreshTokenShape("a".repeat(129)), false);
  assert.equal(isValidRefreshTokenShape(undefined), false);
  assert.equal(isValidRefreshTokenShape(null), false);
  assert.equal(isValidRefreshTokenShape(12345), false);
});

test("rotation slides the expiry forward for a family born now", () => {
  const expiry = nextExpiry(NOW, NOW);
  assert.equal(expiry.getTime(), NOW.getTime() + REFRESH_TOKEN_TTL_MS);
});

test("the family ceiling caps the slide the instant the family is even slightly older", () => {
  // A family born 1s ago already has a ceiling 1s tighter than a fresh 30-day
  // window; min() must pick the ceiling, never the sliding value.
  const familyCreatedAt = new Date(NOW.getTime() - 1000);
  const expiry = nextExpiry(NOW, familyCreatedAt);
  assert.equal(expiry.getTime(), familyCreatedAt.getTime() + REFRESH_TOKEN_TTL_MS);
  assert.ok(expiry.getTime() < NOW.getTime() + REFRESH_TOKEN_TTL_MS);
});

test("rotation can never push a family past its absolute ceiling", () => {
  // Family born 29 days ago: rotation must cap at +1 day, not a fresh 30.
  const familyCreatedAt = new Date(NOW.getTime() - 29 * 24 * 60 * 60 * 1000);
  const expiry = nextExpiry(NOW, familyCreatedAt);
  assert.equal(
    expiry.getTime(),
    familyCreatedAt.getTime() + REFRESH_TOKEN_TTL_MS,
  );
  assert.ok(expiry.getTime() - familyCreatedAt.getTime() <= REFRESH_TOKEN_TTL_MS);
});

test("a family at its ceiling produces an expiry in the past, forcing re-login", () => {
  const familyCreatedAt = new Date(NOW.getTime() - REFRESH_TOKEN_TTL_MS - 1000);
  const expiry = nextExpiry(NOW, familyCreatedAt);
  assert.ok(expiry.getTime() <= NOW.getTime());
});
