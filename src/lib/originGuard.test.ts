import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOrigin, isSameOrigin } from "./originGuard";

const HOST = "catarina.example.com";

test("a matching Origin is allowed", () => {
  const input = { origin: `https://${HOST}`, referer: null, host: HOST };
  assert.equal(classifyOrigin(input), "same-origin");
  assert.equal(isSameOrigin(input), true);
});

test("a foreign Origin is rejected", () => {
  const input = { origin: "https://evil.example", referer: null, host: HOST };
  assert.equal(classifyOrigin(input), "foreign-origin");
  assert.equal(isSameOrigin(input), false);
});

test("`Origin: null` from a sandboxed iframe is REJECTED, not treated as absent", () => {
  // The regression this module exists for: `null` is a real, attacker-reachable
  // header value, and it used to fail open.
  const input = { origin: "null", referer: null, host: HOST };
  assert.equal(classifyOrigin(input), "opaque-or-malformed");
  assert.equal(isSameOrigin(input), false);
});

test("`Origin: NULL` and a padded `null` are rejected too", () => {
  assert.equal(isSameOrigin({ origin: "NULL", referer: null, host: HOST }), false);
  assert.equal(isSameOrigin({ origin: " null ", referer: null, host: HOST }), false);
});

test("an empty Origin header is rejected rather than ignored", () => {
  assert.equal(isSameOrigin({ origin: "", referer: null, host: HOST }), false);
});

test("garbage and malformed origins are rejected, not allowed", () => {
  for (const bad of ["not a url", "https://", "://x", "ht!tp://x", "%%%"]) {
    assert.equal(
      isSameOrigin({ origin: bad, referer: null, host: HOST }),
      false,
      `${bad} must be rejected`,
    );
  }
});

test("a non-http scheme origin is rejected", () => {
  for (const bad of ["file:///etc/passwd", "data:text/html,x", "ftp://x.example"]) {
    assert.equal(
      isSameOrigin({ origin: bad, referer: null, host: HOST }),
      false,
      `${bad} must be rejected`,
    );
  }
});

test("a missing Origin and Referer is allowed for non-browser clients", () => {
  const input = { origin: null, referer: null, host: HOST };
  assert.equal(classifyOrigin(input), "absent");
  assert.equal(isSameOrigin(input), true);
});

test("a same-origin Referer is used when Origin is absent", () => {
  const input = { origin: null, referer: `https://${HOST}/dashboard`, host: HOST };
  assert.equal(isSameOrigin(input), true);
});

test("a foreign Referer is rejected when Origin is absent", () => {
  const input = { origin: null, referer: "https://evil.example/x", host: HOST };
  assert.equal(isSameOrigin(input), false);
});

test("`Referer: null` is rejected too", () => {
  assert.equal(isSameOrigin({ origin: null, referer: "null", host: HOST }), false);
});

test("Origin wins over Referer when both are present", () => {
  const input = {
    origin: `https://${HOST}`,
    referer: "https://evil.example",
    host: HOST,
  };
  assert.equal(isSameOrigin(input), true);
});

test("a missing Host fails closed", () => {
  assert.equal(classifyOrigin({ origin: `https://${HOST}`, referer: null, host: null }), "no-host");
  assert.equal(isSameOrigin({ origin: `https://${HOST}`, referer: null, host: null }), false);
  assert.equal(isSameOrigin({ origin: `https://${HOST}`, referer: null, host: "  " }), false);
});

test("host comparison ignores case", () => {
  assert.equal(isSameOrigin({ origin: "https://CATARINA.Example.com", referer: null, host: "catarina.example.com" }), true);
});

test("an explicitly-sent default port still matches", () => {
  assert.equal(isSameOrigin({ origin: "https://catarina.example.com", referer: null, host: "catarina.example.com:443" }), true);
  assert.equal(isSameOrigin({ origin: "http://catarina.example.com", referer: null, host: "catarina.example.com:80" }), true);
});

test("a different port is a different origin", () => {
  assert.equal(isSameOrigin({ origin: "https://catarina.example.com:8443", referer: null, host: "catarina.example.com" }), false);
});

test("a subdomain is not the same origin", () => {
  assert.equal(isSameOrigin({ origin: "https://evil.catarina.example.com", referer: null, host: HOST }), false);
});

test("a prefix/suffix trick does not pass", () => {
  for (const spoof of [
    `https://${HOST}.evil.example`,
    `https://evil.example/${HOST}`,
    `https://${HOST}@evil.example`,
  ]) {
    assert.equal(isSameOrigin({ origin: spoof, referer: null, host: HOST }), false, `${spoof} must be rejected`);
  }
});

test("a path, query, or fragment on the origin does not affect the verdict", () => {
  assert.equal(isSameOrigin({ origin: `https://${HOST}/a/b?c=d#e`, referer: null, host: HOST }), true);
});

test("a localhost dev origin matches a localhost Host", () => {
  assert.equal(isSameOrigin({ origin: "http://localhost:3000", referer: null, host: "localhost:3000" }), true);
});
