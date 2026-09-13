/**
 * Rate Limiter — Turso (libsql) true sliding window for production,
 * falls back to in-memory for local dev when DATABASE_URL isn't configured.
 *
 * Why this matters on Vercel:
 *   Each serverless function invocation can be a NEW cold start with empty memory.
 *   The old in-memory Map reset on every cold start, so a brute-force attacker
 *   hitting 1000 requests would get 1000 fresh maps — rate limit never triggered.
 *   Turso lives outside Vercel, so ALL instances share the same counter.
 *
 * How it works (production):
 *   1. Request arrives → getClientIp extracts IP from x-forwarded-for
 *   2. checkRateLimit(key, max, window) → records an event row + counts it
 *   3. DELETE this key's rows that fell out of the window (bounded per-key cleanup)
 *   4. INSERT an event for this attempt (blocked attempts are recorded too)
 *   5. SELECT COUNT(*) in [now - window, now] — shared across all instances
 *   6. If count > max → { limited: true, retryAfterMs: oldest + window - now }
 *   7. Steps 3-5 run as ONE atomic batch (transaction) — a concurrent request can
 *      never undercount the window and slip past the limiter.
 *
 * Fail-open: if the store errors we log (throttled) and allow the request,
 * so a Turso hiccup never bricks login/upload/bcrypt is still the real defense.
 */

import { createClient, type Client, type InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";

const MAX_KEY_LENGTH = 160; // bound pathological header/userId rows

/* ── Shared Turso client (lazy singleton) ─────────────── */
let db: Client | null = null;

function getDb(): Client | null {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    db = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: "number",
    });
  } catch {
    db = null;
  }
  return db;
}

/**
 * Global hygiene sweep. Deletes events older than now - SWEEP_MARGIN_MS.
 *
 * INVARIANT: SWEEP_MARGIN_MS must always exceed the longest window used by any
 * caller PLUS clock skew between serverless instances, otherwise this sweep
 * could delete events that still belong to a live window. Longest window today
 * is register (5 min). See src/app/api/auth/register/route.ts.
 */
const SWEEP_MARGIN_MS = 10 * 60_000; // 10 min > 5 min max window
const SWEEP_INTERVAL_MS = 60_000; // at most once per minute per instance

let lastGlobalSweep = 0;
let lastErrorLog = 0;

export type SlidingWindowOptions = {
  /** Injectable clock (tests). Defaults to Date.now(). */
  now?: number;
  /** Force the throttled global sweep (tests). Defaults to the interval check. */
  forceSweep?: boolean;
};

/**
 * Sliding-window check against a libsql/Turso client. Exported for tests.
 * All statements run atomically in one transaction + one round trip.
 * The SELECT is always the LAST batch statement so its result set is at `results.at(-1)`.
 */
export async function tursoSlidingWindowCheck(
  client: Client,
  key: string,
  maxRequests: number,
  windowMs: number,
  opts: SlidingWindowOptions = {}
): Promise<{ limited: boolean; retryAfterMs: number }> {
  const now = opts.now ?? Date.now();
  const windowStart = now - windowMs;

  const stmts: InStatement[] = [];

  const sweepDue = opts.forceSweep === true || now - lastGlobalSweep > SWEEP_INTERVAL_MS;
  if (sweepDue) {
    lastGlobalSweep = now;
    stmts.push({
      sql: "DELETE FROM rate_limit_events WHERE ts < ?",
      args: [now - SWEEP_MARGIN_MS],
    });
  }

  stmts.push(
    {
      sql: "DELETE FROM rate_limit_events WHERE key = ? AND ts < ?",
      args: [key, windowStart],
    },
    {
      sql: "INSERT INTO rate_limit_events (id, key, ts) VALUES (?, ?, ?)",
      args: [randomUUID(), key, now],
    },
    {
      sql: "SELECT COUNT(*) AS count, MIN(ts) AS oldest FROM rate_limit_events WHERE key = ? AND ts >= ?",
      args: [key, windowStart],
    }
  );

  const results = await client.batch(stmts, "write");
  const row = results[results.length - 1].rows[0] as unknown as
    | { count: number; oldest: number | null }
    | undefined;

  const count = Number(row?.count ?? 0);
  const oldest = row?.oldest == null ? null : Number(row.oldest);

  if (count > maxRequests) {
    const retryAfterMs = oldest == null ? 0 : Math.max(0, oldest + windowMs - now);
    return { limited: true, retryAfterMs };
  }

  return { limited: false, retryAfterMs: 0 };
}

/**
 * Check rate limit for a given key (typically IP-prefixed).
 * Returns { limited: true, retryAfterMs } if rate limit exceeded.
 *
 * In production (Turso): uses a shared table across all Vercel instances.
 * In local dev (no DATABASE_URL): falls back to an in-memory Map per instance.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: false } | { limited: true; retryAfterMs: number }> {
  const safeKey = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;

  const client = getDb();

  /* ── Turso path ─────────────────────────────────────── */
  if (client) {
    try {
      const result = await tursoSlidingWindowCheck(client, safeKey, maxRequests, windowMs);
      return result;
    } catch (error) {
      // Throttle error logs to 1/min per instance to avoid log flooding during outages
      if (Date.now() - lastErrorLog > SWEEP_INTERVAL_MS) {
        lastErrorLog = Date.now();
        console.error("[RATE_LIMIT] Turso check failed, fail-open:", (error as Error).message);
      }
      return { limited: false };
    }
  }

  /* ── In-memory fallback (local dev) ────────────────── */
  const now = Date.now();
  const entry = memStore.get(safeKey);

  if (!entry || now > entry.resetAt) {
    memStore.set(safeKey, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfterMs = entry.resetAt - now;
    return { limited: true, retryAfterMs };
  }

  return { limited: false };
}

/* ── In-memory fallback store (local dev only) ────────── */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

/** Get client IP from request headers.
 * Uses the RIGHTMOST x-forwarded-for hop (added by the closest trusted proxy)
 * or x-real-ip, so a client cannot rotate their rate-limit key by prepending a
 * spoofed x-forwarded-for header. */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}