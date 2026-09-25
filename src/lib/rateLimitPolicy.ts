/**
 * Rate-limit policy — pure, dependency-free key derivation.
 *
 * WHY THIS EXISTS: the limiter used to key on a client-controlled IP header
 * (`x-real-ip` / rightmost `x-forwarded-for`). Rotating that header minted a
 * fresh bucket per request, so EVERY limit in the app — login, register,
 * refresh, upload — was bypassable. That mattered most for login: rate
 * limiting was the compensating control 0.7.0 accepted in place of refresh
 * rotation, so password guessing was effectively unthrottled.
 *
 * Two independent layers now apply, and the important one is the account key:
 *
 *  1. ACCOUNT layer — keyed on a hash of the email, never on anything the
 *     client sends. A caller cannot mint a new bucket by forging a header, so
 *     this is what actually stops password guessing against one account.
 *  2. IP layer — best-effort and coarse. It only uses a header the deployment
 *     explicitly declares trusted; with nothing declared, every caller shares
 *     ONE bucket rather than getting an unlimited supply of attacker-chosen
 *     ones. That is deliberately fail-closed: it can throttle legitimate users
 *     behind one NAT, but it cannot be turned off by forging a header.
 *
 * Account keys are hashed so no plaintext email is written to the shared
 * rate-limit table (the mandate forbids storing PII there).
 */

import { createHash } from "node:crypto";

/** Bucket used when no trusted IP header is configured or present. */
export const SHARED_IP_BUCKET = "shared";

/** Bound on any single key component, so a hostile header can't bloat a row. */
const MAX_IP_LENGTH = 45; // longest IPv6 text form + slack

/**
 * A usable IP token: printable, no separators, no whitespace/control chars.
 * Anything else is treated as untrusted input and discarded — a bucket name is
 * not a place to accept arbitrary bytes.
 */
export function isValidIpToken(value: string): boolean {
  if (!value || value.length > MAX_IP_LENGTH) return false;
  return /^[0-9a-f:.a-z_-]+$/i.test(value);
}

/**
 * Resolve the client IP for coarse rate-limit keying.
 *
 * `trustedHeader` is the deployment's own configuration (e.g. the header its
 * proxy overwrites). We read ONLY that header — never a client's arbitrary
 * choice of header — so an attacker cannot influence the key at all unless
 * they control the trusted header's value, which is the proxy's job to prevent.
 *
 * With no trusted header configured, every caller collapses into one shared
 * bucket: fail-closed, and bounded in table cardinality.
 */
export function resolveClientIp(
  headers: { get(name: string): string | null },
  trustedHeader?: string | null,
): string {
  const name = trustedHeader?.trim().toLowerCase();
  if (!name) return SHARED_IP_BUCKET;

  const raw = headers.get(name);
  if (!raw) return SHARED_IP_BUCKET;

  /* Proxies may send a comma-joined chain. When the deployment declares this
     header trusted, the platform has already normalized it; take the value
     whole-but-bounded, and if it isn't a clean token, don't trust it at all. */
  const candidate = raw.split(",")[0]?.trim() ?? "";
  return isValidIpToken(candidate) ? candidate : SHARED_IP_BUCKET;
}

/**
 * Build the per-account rate-limit key for a scope (e.g. "login").
 * Hashed: the shared table must never hold a plaintext email, and a hash can't
 * be walked back into an address book.
 */
export function accountRateLimitKey(scope: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `${scope}:acct:${digest}`;
}

/** Per-IP key for a scope. */
export function ipRateLimitKey(scope: string, ip: string): string {
  return `${scope}:ip:${ip}`;
}
