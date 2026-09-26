/**
 * The order of operations for a login attempt, as a pure policy.
 *
 * WHY THIS IS A SEPARATE MODULE: the anti-brute-force property of the login
 * route is not "we count failures" — it is that an account over its failure
 * budget is refused BEFORE the password is verified. That ordering is invisible
 * in a route handler and impossible to assert against one, so it lives here with
 * its collaborators injected, and the route is a thin adapter.
 *
 * The bug this encodes against: the account limiter used to run on the failure
 * branch only, AFTER the credential check. A correct password therefore never
 * consulted the counter — the counter grew, wrong attempts turned into 429s, and
 * a right guess still logged in. That is a counter, not a lockout, and a patient
 * distributed attacker was never stopped.
 */

export interface AttemptWindow {
  limited: boolean;
}

export interface LoginAttemptDeps<T> {
  /** Read-only: is this account currently over its failure budget? */
  peekAccount: () => Promise<AttemptWindow>;
  /** Record one genuine credential failure. */
  chargeAccount: () => Promise<void>;
  /** Drop the failure history after a success. */
  clearAccount: () => Promise<void>;
  /**
   * The expensive part: look the account up and compare the password hash.
   * Returns the resolved value so the caller does not have to smuggle it out
   * through a variable it assigns from inside this callback.
   */
  verify: () => Promise<{ ok: boolean; value: T | null }>;
}

export type LoginAttemptOutcome<T> =
  /** Over budget: the password was never checked. */
  | { kind: "rate-limited" }
  /** Wrong password, or no such account. */
  | { kind: "invalid" }
  /** Authenticated. */
  | { kind: "ok"; value: T };

export async function runLoginAttempt<T>(
  deps: LoginAttemptDeps<T>,
): Promise<LoginAttemptOutcome<T>> {
  /* 1. Gate FIRST, and charge nothing. A correct password must not be able to
        slip past because the account is over budget. */
  const window = await deps.peekAccount();
  if (window.limited) return { kind: "rate-limited" };

  /* 2. Only now spend the bcrypt comparison. */
  const { ok, value } = await deps.verify();
  if (!ok || value === null) {
    /* 3. A genuine failure is what costs budget — never a success. */
    await deps.chargeAccount();
    return { kind: "invalid" };
  }

  /* 4. A success clears the history, so ordinary typos never accumulate into a
        lockout for the next sign-in. */
  await deps.clearAccount();
  return { kind: "ok", value };
}
