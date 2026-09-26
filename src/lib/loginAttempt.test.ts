import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runLoginAttempt } from "./loginAttempt";

/* The property under test is the ORDER of operations, not the counting: an
   account over its failure budget must be refused BEFORE the password is
   verified. The bug this guards against ran the account limiter on the failure
   branch only, so a correct password never consulted the counter and still
   logged in — a counter, not a lockout. */

interface Calls {
  peek: number;
  verify: number;
  charge: number;
  clear: number;
}

function harness(opts: { limited?: boolean; ok?: boolean; value?: unknown }) {
  const calls: Calls = { peek: 0, verify: 0, charge: 0, clear: 0 };
  const deps = {
    peekAccount: async () => {
      calls.peek++;
      return { limited: opts.limited === true };
    },
    chargeAccount: async () => {
      calls.charge++;
    },
    clearAccount: async () => {
      calls.clear++;
    },
    verify: async () => {
      calls.verify++;
      return { ok: opts.ok !== false, value: (opts.value ?? { id: "u1" }) as never };
    },
  };
  return { calls, run: () => runLoginAttempt(deps) };
}

describe("an over-budget account is refused before the password is checked", () => {
  test("a CORRECT password is still rejected when over budget", async () => {
    // This is the exact regression: `ok: true` (the password is right) must not
    // be able to slip past a locked account.
    const h = harness({ limited: true, ok: true });
    const outcome = await h.run();
    assert.equal(outcome.kind, "rate-limited");
    assert.equal(h.calls.verify, 0, "the password was verified despite the lockout");
  });

  test("a wrong password over budget is rejected the same way", async () => {
    const h = harness({ limited: true, ok: false });
    const outcome = await h.run();
    assert.equal(outcome.kind, "rate-limited");
    assert.equal(h.calls.verify, 0);
  });

  test("a blocked attempt charges nothing", async () => {
    // Charging here would extend the lockout on every rejected request, turning
    // a bounded 15-minute lockout into an escalating one.
    const h = harness({ limited: true });
    await h.run();
    assert.equal(h.calls.charge, 0);
  });

  test("the gate is consulted before the comparison", async () => {
    const order: string[] = [];
    await runLoginAttempt({
      peekAccount: async () => {
        order.push("peek");
        return { limited: false };
      },
      chargeAccount: async () => {
        order.push("charge");
      },
      clearAccount: async () => {
        order.push("clear");
      },
      verify: async () => {
        order.push("verify");
        return { ok: false, value: null };
      },
    });
    assert.deepEqual(order, ["peek", "verify", "charge"]);
  });
});

describe("under budget, failures are charged and successes are not", () => {
  test("a wrong password is charged", async () => {
    const h = harness({ limited: false, ok: false });
    const outcome = await h.run();
    assert.equal(outcome.kind, "invalid");
    assert.equal(h.calls.charge, 1);
    assert.equal(h.calls.clear, 0, "a failure must not clear the history");
  });

  test("an unknown account is charged like a wrong password", async () => {
    const h = harness({ limited: false, ok: false, value: null });
    const outcome = await h.run();
    assert.equal(outcome.kind, "invalid");
    assert.equal(h.calls.charge, 1);
  });

  test("a correct password is NOT charged and clears the history", async () => {
    const h = harness({ limited: false, ok: true });
    const outcome = await h.run();
    assert.equal(outcome.kind, "ok");
    assert.equal(h.calls.charge, 0, "a correct password consumed failure budget");
    assert.equal(h.calls.clear, 1, "a success did not reset the failure history");
  });

  test("the resolved account is handed back to the caller", async () => {
    const user = { id: "u1", email: "a@b.c" };
    const h = harness({ limited: false, ok: true, value: user });
    const outcome = await h.run();
    assert.equal(outcome.kind, "ok");
    assert.deepEqual(outcome.kind === "ok" ? outcome.value : null, user);
  });
});

describe("repeated sign-ins cannot lock a user out of their own account", () => {
  test("ten correct attempts in a row never trip the gate", async () => {
    // Simulates the bug that motivated charging only failures: a teammate who
    // signs in repeatedly used to burn budget and lock themselves out.
    let failures = 0;
    const MAX = 10;
    for (let i = 0; i < 25; i++) {
      const outcome = await runLoginAttempt<{ id: string }>({
        peekAccount: async () => ({ limited: failures >= MAX }),
        chargeAccount: async () => {
          failures++;
        },
        clearAccount: async () => {
          failures = 0;
        },
        verify: async () => ({ ok: true, value: { id: "u1" } }),
      });
      assert.equal(outcome.kind, "ok", `attempt ${i + 1} was refused`);
    }
    assert.equal(failures, 0, "successes left failure budget behind");
  });

  test("typos do not accumulate into a lockout once the user signs in", async () => {
    let failures = 0;
    const MAX = 10;
    const attempt = async (ok: boolean) =>
      runLoginAttempt<{ id: string }>({
        peekAccount: async () => ({ limited: failures >= MAX }),
        chargeAccount: async () => {
          failures++;
        },
        clearAccount: async () => {
          failures = 0;
        },
        verify: async () => ({ ok, value: ok ? { id: "u1" } : null }),
      });

    for (let i = 0; i < 8; i++) await attempt(false); // fat-fingered the password
    assert.equal((await attempt(true)).kind, "ok"); // signed in
    assert.equal(failures, 0);
    assert.equal((await attempt(false)).kind, "invalid", "budget did not reset");
  });
});

describe("a patient attacker is stopped", () => {
  test("guesses beyond the budget are refused, right or wrong", async () => {
    let failures = 0;
    const MAX = 10;
    let refused = 0;
    // The attacker keeps trying; the 11th guess onward must never be verified,
    // even when it happens to be the right password.
    let verified = 0;
    for (let i = 0; i < 30; i++) {
      const correct = i === 25;
      const outcome = await runLoginAttempt<{ id: string }>({
        peekAccount: async () => ({ limited: failures >= MAX }),
        chargeAccount: async () => {
          failures++;
        },
        clearAccount: async () => {},
        verify: async () => {
          verified++;
          return { ok: correct, value: correct ? { id: "u1" } : null };
        },
      });
      if (outcome.kind === "rate-limited") refused++;
      else if (outcome.kind === "ok") assert.fail(`guess ${i + 1} was allowed through`);
    }
    // Attempts 1..10 consume the budget, so the remaining 20 — including the
    // one that would have been correct — are
    // refused without ever reaching the password comparison.
    assert.equal(verified, MAX, "the password was compared after the failure budget");
    assert.equal(refused, 20, "every guess past the budget should be refused");
  });
});
