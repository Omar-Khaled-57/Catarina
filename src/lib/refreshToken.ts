/**
 * Server-only refresh-token helpers — per-device "remember me" tokens. This
 * file must ONLY be imported in Server Components or route handlers (it talks
 * to Prisma).
 *
 * The short-lived HttpOnly JWT session cookie is the request credential. A
 * device that wants a persistent login also holds a random 256-bit refresh
 * token in localStorage, which it exchanges for a fresh session cookie on every
 * visit (see POST /api/auth/refresh). Only the sha256 hash is persisted, so a
 * leaked database row can't be used directly as a credential.
 *
 * Rotation: every exchange is single-use. The presented token is marked spent
 * and replaced by a fresh one in the same family, and each token carries an
 * absolute expiry. Presenting an already-spent token means the raw value
 * leaked, so the entire family is revoked instead of merely rejecting that one
 * call — a stolen token can never be quietly re-used. All accept/reject
 * reasoning lives in the pure ./refreshPolicy module so it is directly
 * testable; this file only performs the I/O.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  REFRESH_TOKEN_TTL_MS,
  decideRefresh,
  isValidRefreshTokenShape,
  nextExpiry,
} from "@/lib/refreshPolicy";

/** Hash a raw token for storage — DB rows store the hash, never the value. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

/** Revoke an entire token family (every rotation of one login lineage). */
async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revoked: false },
    data: { revoked: true },
  });
}

/**
 * Issue the first token of a new family (login / registration). The family
 * ceiling starts here: every later rotation is capped relative to this row's
 * createdAt, so a login can never stay valid forever.
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const raw = newRawToken();
  const now = new Date();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      familyId: newRawToken(),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

export type RotationResult =
  | { ok: true; userId: string; refreshToken: string }
  | { ok: false };

/**
 * Exchange a raw refresh token for a fresh session credential AND a rotated
 * replacement token. Fails closed: unknown, revoked, orphaned, or expired
 * tokens are rejected; a replayed (already-spent) token additionally revokes
 * the whole family.
 */
export async function rotateRefreshToken(raw: string): Promise<RotationResult> {
  if (!isValidRefreshTokenShape(raw)) return { ok: false };

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: {
      id: true,
      userId: true,
      familyId: true,
      revoked: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true } },
    },
  });

  const now = new Date();
  const decision = decideRefresh(
    record
      ? {
          revoked: record.revoked,
          usedAt: record.usedAt,
          expiresAt: record.expiresAt,
          hasUser: !!record.user,
        }
      : null,
    now,
  );

  if (decision === "reuse" && record) {
    // Replay of a spent token: treat the value as compromised and kill every
    // rotation of this login. The family ceiling still holds for the winner.
    await revokeFamily(record.familyId);
    return { ok: false };
  }
  if (decision !== "accept" || !record) return { ok: false };

  // Atomic single-use consume: exactly one exchange can win the race, so two
  // parallel refreshes can never both mint a successor from one token.
  const consumed = await prisma.refreshToken.updateMany({
    where: { id: record.id, usedAt: null, revoked: false },
    data: { usedAt: now },
  });
  if (consumed.count === 0) {
    // Lost the race — another exchange already spent this token, which is the
    // same reuse signal. Fail closed and revoke the family.
    await revokeFamily(record.familyId);
    return { ok: false };
  }

  // The family's absolute ceiling is set by its oldest (root) token.
  const oldest = await prisma.refreshToken.findFirst({
    where: { familyId: record.familyId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const expiresAt = nextExpiry(now, oldest?.createdAt ?? now);

  const next = newRawToken();
  await prisma.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: hashToken(next),
      familyId: record.familyId,
      expiresAt,
    },
  });

  return { ok: true, userId: record.userId, refreshToken: next };
}

/**
 * Revoke a raw refresh token (logout). Kills the whole family, not just the
 * presented row, so a copy taken before rotation cannot outlive the logout.
 * No-op for unknown tokens.
 */
export async function revokeRefreshToken(raw: string): Promise<void> {
  if (!isValidRefreshTokenShape(raw)) return;
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { familyId: true },
  });
  if (record) await revokeFamily(record.familyId);
}
