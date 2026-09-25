/**
 * Refresh-token policy — pure, dependency-free decision logic.
 *
 * Deliberately free of any Prisma import so the security invariants can be
 * unit-tested directly (importing the Prisma-backed module requires
 * DATABASE_URL and a live adapter). The I/O wrapper in ./refreshToken.ts owns
 * all database access and defers every accept/reject decision here.
 *
 * The model is single-use rotation: each successful exchange marks the
 * presented token spent and issues a replacement in the same family. That only
 * means something if replaying a spent token is treated as theft rather than
 * as a harmless retry, which is what the "reuse" decision signals.
 */

/** Absolute lifetime of a refresh token and of its whole family: 30 days. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Raw tokens are 32 random bytes hex-encoded (64 chars). The bounds are
 *  deliberately wider than that so a future encoding change doesn't silently
 *  reject valid tokens, while still rejecting junk early. */
export function isValidRefreshTokenShape(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length >= 32 && raw.length <= 128;
}

export interface RefreshTokenFacts {
  revoked: boolean;
  /** Set once the token has been exchanged (rotated away). */
  usedAt: Date | null;
  expiresAt: Date;
  /** False when the owning user no longer exists. */
  hasUser: boolean;
}

export type RefreshDecision =
  /** Exchange may proceed. */
  | "accept"
  /** Ordinary failure: unknown, revoked, orphaned, or expired. Reject quietly. */
  | "reject"
  /** A spent token was presented again — the value leaked. Revoke the family. */
  | "reuse";

export function decideRefresh(
  record: RefreshTokenFacts | null,
  now: Date,
): RefreshDecision {
  if (!record) return "reject";
  // An orphaned token is a zombie session — the user was deleted but the row
  // outlived it. Fail closed, exactly like requireUser's guard.
  if (!record.hasUser) return "reject";
  if (record.revoked) return "reject";
  // The decisive check: this token was already exchanged once. Only two causes
  // are possible — a stolen copy being replayed, or a client that kept using a
  // superseded token. Both warrant killing the family.
  if (record.usedAt) return "reuse";
  if (record.expiresAt.getTime() <= now.getTime()) return "reject";
  return "accept";
}

/** New expiry for a rotated token: a sliding window, but never past the
 *  family's absolute ceiling (the family's oldest token's creation + TTL). A
 *  family therefore cannot extend itself forever no matter how often it is
 *  rotated — this is what makes the old "never expires" design unreachable. */
export function nextExpiry(
  now: Date,
  familyCreatedAt: Date,
): Date {
  const sliding = now.getTime() + REFRESH_TOKEN_TTL_MS;
  const ceiling = familyCreatedAt.getTime() + REFRESH_TOKEN_TTL_MS;
  return new Date(Math.min(sliding, ceiling));
}
