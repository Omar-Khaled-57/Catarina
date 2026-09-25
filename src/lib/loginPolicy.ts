/**
 * Login password-verification policy — pure, dependency-free.
 *
 * WHY: the login route used to return early when an email was unknown, and
 * only call `bcrypt.compare` when the account existed. A wrong password
 * therefore cost ~100ms of bcrypt while an unknown email cost a fast database
 * miss — a timing gap that let anyone enumerate registered accounts even though
 * both branches returned the same 401 and the same message.
 *
 * The fix is to ALWAYS perform one comparison of the same cost. When there is
 * no stored hash we compare against a throwaway cost-12 hash of a discarded
 * random secret: the work is identical, the result is always false, and no
 * password can ever match it. The comparator is injected so the invariant can
 * be unit-tested without measuring wall-clock time.
 */

/**
 * bcrypt (cost 12) hash of a 32-byte random secret that was discarded at
 * generation time and is not recorded anywhere. Its plaintext is unknown and
 * unrecoverable, so this can never authenticate anyone — it exists purely to
 * equalize the cost of the "no such account" path.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$iMbKziNKKUAxasVcoDXDLOkL7I/GBCtrtj3/68Ie89t/voR3aEdNe";

export type PasswordComparator = (
  password: string,
  hash: string,
) => Promise<boolean>;

/**
 * Verify a login attempt without leaking, through timing, whether the account
 * exists. Returns false for an unknown account, a wrong password, or a
 * malformed stored hash — never throws.
 */
export async function verifyLoginPassword(
  password: string,
  storedHash: string | null,
  compare: PasswordComparator,
): Promise<boolean> {
  const hash = storedHash ?? DUMMY_PASSWORD_HASH;
  let matched = false;
  try {
    matched = await compare(password, hash);
  } catch {
    /* A corrupt stored hash must fail closed, and must not skip the work. */
    return false;
  }
  /* An unknown account can never authenticate, regardless of what the
     comparison against the dummy hash returned. */
  return storedHash !== null && matched;
}

/** The single response body for every failed login, whatever the cause. */
export const LOGIN_FAILURE_MESSAGE = "Invalid email or password";
