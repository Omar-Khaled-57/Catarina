import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHARED_IP_BUCKET,
  accountRateLimitKey,
  ipRateLimitKey,
  isValidIpToken,
  resolveClientIp,
} from "./rateLimitPolicy";

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

test("no trusted header configured => one shared bucket, not the client's claim", () => {
  // The regression: an attacker sending X-Real-IP per request used to mint a
  // fresh bucket every time. With nothing declared trusted, that header is
  // simply not read.
  const spoofed = headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8" });
  assert.equal(resolveClientIp(spoofed), SHARED_IP_BUCKET);
  assert.equal(resolveClientIp(spoofed, ""), SHARED_IP_BUCKET);
  assert.equal(resolveClientIp(spoofed, "   "), SHARED_IP_BUCKET);
});

test("only the declared trusted header is read", () => {
  const h = headers({ "x-real-ip": "1.1.1.1", "cf-connecting-ip": "2.2.2.2" });
  assert.equal(resolveClientIp(h, "cf-connecting-ip"), "2.2.2.2");
  assert.equal(resolveClientIp(h, "x-real-ip"), "1.1.1.1");
});

test("trusted header lookup is case-insensitive and chain-aware", () => {
  const h = headers({ "x-vercel-forwarded-for": "203.0.113.9, 70.41.3.18" });
  assert.equal(resolveClientIp(h, "X-VERCEL-FORWARDED-FOR"), "203.0.113.9");
});

test("a missing trusted header falls back to the shared bucket", () => {
  assert.equal(resolveClientIp(headers({}), "x-real-ip"), SHARED_IP_BUCKET);
});

test("a hostile or malformed trusted value is discarded, not used as a key", () => {
  assert.equal(resolveClientIp(headers({ "x-ip": "a b c" }), "x-ip"), SHARED_IP_BUCKET);
  assert.equal(resolveClientIp(headers({ "x-ip": "'; DROP TABLE--" }), "x-ip"), SHARED_IP_BUCKET);
  assert.equal(resolveClientIp(headers({ "x-ip": "1.2.3.4\n5.6.7.8" }), "x-ip"), SHARED_IP_BUCKET);
  assert.equal(resolveClientIp(headers({ "x-ip": "x".repeat(200) }), "x-ip"), SHARED_IP_BUCKET);
});

test("ip token validation accepts real forms and rejects junk", () => {
  assert.equal(isValidIpToken("203.0.113.9"), true);
  assert.equal(isValidIpToken("2001:db8::1"), true);
  assert.equal(isValidIpToken(""), false);
  assert.equal(isValidIpToken("1.2.3.4 5.6.7.8"), false);
  assert.equal(isValidIpToken("a".repeat(46)), false);
});

test("the account key cannot be rotated by forging any header", () => {
  // Same email => same key, always. This is what makes brute force stoppable.
  const a = accountRateLimitKey("login", "User@Example.com ");
  const b = accountRateLimitKey("login", "user@example.com");
  assert.equal(a, b);
  assert.match(a, /^login:acct:[0-9a-f]{64}$/);
});

test("the account key never contains the plaintext email", () => {
  const key = accountRateLimitKey("login", "victim@example.com");
  assert.equal(key.includes("victim"), false);
  assert.equal(key.includes("example.com"), false);
});

test("scopes and accounts don't collide", () => {
  assert.notEqual(
    accountRateLimitKey("login", "a@b.com"),
    accountRateLimitKey("register", "a@b.com"),
  );
  assert.notEqual(
    accountRateLimitKey("login", "a@b.com"),
    accountRateLimitKey("login", "c@d.com"),
  );
});

test("ip keys are namespaced by scope", () => {
  assert.equal(ipRateLimitKey("login", "1.2.3.4"), "login:ip:1.2.3.4");
  assert.notEqual(
    ipRateLimitKey("login", SHARED_IP_BUCKET),
    ipRateLimitKey("register", SHARED_IP_BUCKET),
  );
});
