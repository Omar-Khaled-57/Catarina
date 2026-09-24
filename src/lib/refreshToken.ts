/**
 * Server-only refresh-token helpers — long-lived per-device "remember me"
 * tokens. This file must ONLY be imported in Server Components or route
 * handlers (it talks to Prisma).
 *
 * Design: the short-lived HttpOnly JWT session cookie is the request
 * credential. A device that wants a persistent login also holds a random
 * 256-bit refresh token in localStorage, which it exchanges for a fresh
 * session cookie on every visit (see POST /api/auth/refresh). Tokens never
 * expire by design; they are only invalidated by logout or user deletion.
 * Only the sha256 hash is persisted, so a leaked database row can't be used
 * directly as a credential.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Hash a raw token for storage — DB rows store the hash, never the value. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a fresh refresh token, persist its hash, return the raw value. */
export async function generateRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw) },
  });
  return raw;
}

/**
 * Validate a raw refresh token. Returns the owning user's ID, or null when
 * the token is unknown, revoked, or its user no longer exists (fail-closed,
 * mirroring requireUser's zombie-session guard).
 */
export async function verifyRefreshToken(raw: string): Promise<string | null> {
  if (typeof raw !== "string" || raw.length < 32 || raw.length > 128) {
    return null;
  }
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { userId: true, revoked: true, user: { select: { id: true } } },
  });
  if (!record || record.revoked || !record.user) return null;
  return record.userId;
}

/** Revoke a raw refresh token (used by logout). No-op for unknown tokens. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  if (typeof raw !== "string" || raw.length < 32 || raw.length > 128) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revoked: false },
    data: { revoked: true },
  });
}