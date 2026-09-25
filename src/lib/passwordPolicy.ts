/**
 * Password strength policy — pure, dependency-free, no imports.
 *
 * WHY: the minimum length was 6, which is short enough that a six-character
 * password is cheap to brute-force offline if the database ever leaks, and
 * short enough that people pick `123456`. The accepted policy is deliberately
 * minimal, because composition rules (one upper, one digit, one symbol) mostly
 * produce predictable variants — `Password1!` is weaker in practice than a
 * multi-word passphrase of the same length.
 *
 * So: a real length floor, plus a blocklist of the passwords that show up at
 * the top of every breach corpus. No forced character classes, no forced
 * periodic rotation, no complexity score.
 *
 * This is enforced only when a password is SET (registration, self-service
 * change, admin create/reset). Existing hashes are never re-validated, so
 * raising the floor cannot lock an existing user out of their account.
 */

/** Floor for a newly chosen password. */
export const PASSWORD_MIN_LEN = 8;
/** Upper bound on characters, to keep request bodies and bcrypt input sane. */
export const PASSWORD_MAX_LEN = 200;
/**
 * bcrypt only consumes the first 72 bytes of the key. Silently truncating would
 * make two passwords sharing a 72-byte prefix authenticate identically, so we
 * reject anything longer instead.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * The most common breached passwords, as of the current leak corpora. Compared
 * case-insensitively after trimming. Entries shorter than PASSWORD_MIN_LEN are
 * unreachable (the length check rejects them first) but are kept so the list
 * stays meaningful if the floor ever changes.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "12345678a",
  "qwerty123",
  "qwertyui",
  "letmein123",
  "iloveyou1",
  "admin1234",
  "administrator",
  "welcome123",
  "welcome1",
  "monkey123",
  "dragon123",
  "master123",
  "trustno1",
  "sunshine1",
  "princess1",
  "football1",
  "baseball1",
  "superman1",
  "starwars1",
  "whatever1",
  "computer1",
  "internet1",
  "abc12345",
  "abcd1234",
  "jordan123",
  "michael1",
  "jennifer1",
  "harley123",
  "ranger123",
  "charlie1",
  "shadow123",
  "michael123",
  "jessica123",
  "mustang1",
  "access123",
  "flower123",
  "passwort1",
  "secret123",
  "azerty123",
]);

/** Is this password one of the well-known compromised ones? */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}

export type PasswordDecision =
  | { ok: true; password: string }
  | { ok: false; message: string };

/**
 * Validate a plaintext password that is being set: length bounds, the bcrypt
 * 72-byte cap, and the common-password blocklist. Returns the password
 * unchanged on success so callers can use it directly.
 */
export function decidePassword(value: unknown): PasswordDecision {
  const password = typeof value === "string" ? value : null;
  if (!password) return { ok: false, message: "Password is required" };

  if (password.length < PASSWORD_MIN_LEN) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LEN} characters`,
    };
  }
  if (password.length > PASSWORD_MAX_LEN) {
    return {
      ok: false,
      message: `Password must be at most ${PASSWORD_MAX_LEN} characters`,
    };
  }
  /* TextEncoder rather than Buffer so this module stays importable from a
     client component (which needs PASSWORD_MIN_LEN for its input attributes). */
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return { ok: false, message: "Password is too long (maximum 72 bytes)" };
  }
  if (isCommonPassword(password)) {
    return {
      ok: false,
      message:
        "That password is too common — please choose something less predictable",
    };
  }

  return { ok: true, password };
}
