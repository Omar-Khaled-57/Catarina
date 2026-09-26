import { test } from "node:test";
import assert from "node:assert/strict";
import { isDatabaseUnavailable } from "./databaseError";

test("recognizes nested libSQL connect timeouts", () => {
  assert.equal(
    isDatabaseUnavailable({
      name: "TypeError",
      message: "fetch failed",
      cause: { name: "ConnectTimeoutError", code: "UND_ERR_CONNECT_TIMEOUT" },
    }),
    true,
  );
});

test("recognizes Prisma database reachability errors", () => {
  assert.equal(isDatabaseUnavailable({ code: "P1001" }), true);
});

test("does not classify validation or application errors as database outages", () => {
  assert.equal(isDatabaseUnavailable(new Error("Invalid drawer action")), false);
  assert.equal(isDatabaseUnavailable(null), false);
});