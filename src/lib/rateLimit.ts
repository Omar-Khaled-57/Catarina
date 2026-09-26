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
 *   1. Request arrives → the caller supplies its key. Credential routes use a
 *      per-ACCOUNT key (a hash of the email — no header can influence it) and
 *      a coarse per-IP key; everything else uses a per-IP key.
 *   2. checkRateLimit(key, max, window) → records an event row + counts it
 *   3. DELETE this key's rows that fell out of the window (bounded per-key cleanup)
 *   4. INSERT an event for this attempt (blocked attempts are recorded too)
 *   5. SELECT COUNT(*) in [now - window, now] — shared across all instances
 *   6. If count > max → { limited: true, retryAfterMs: oldest + window - now }
 *   7. Steps 3-5 run as ONE atomic batch (transaction) — a concurrent request can
 *      never undercount the window and slip past the limiter.
 *
 * Fail-safe: if the store errors we fall through to a bounded in-memory
 * counter instead of allowing the request. A limiter that fails open removes
 * brute-force protection for exactly as long as the database is unhealthy.
 * The in-memory path is per-instance, so it is a weaker backstop, not a
 * replacement — but a bound beats no bound. See @/lib/rateLimitPolicy for why
 * the IP key can no longer be chosen by the client.
 */

import { createClient, type Client, type InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { resolveClientIp } from "@/lib/rateLimitPolicy";

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
 * is login's per-account layer (15 min). See src/app/api/auth/login/route.ts.
 */
export const SWEEP_MARGIN_MS = 20 * 60_000; // 20 min > 15 min max window, 5 min skew headroom
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
        console.error("[RATE_LIMIT] Turso check failed, using in-memory backstop:", (error as Error).message);
      }
      /* Fall THROUGH to the in-memory path rather than allowing the request.
         A limiter that fails fully open removes brute-force protection for as
         long as the store is down — the worst possible moment to be
         unprotected. Per-instance, so it is weaker than the shared counter, but
         it is a real bound instead of no bound. */
    }
  }

  /* ── In-memory path (local dev, and the Turso-outage backstop) ── */
  const now = Date.now();
  pruneMemStore(now);
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

/**
 * Sliding-window PEEK against a libsql/Turso client: report whether a key is
 * over budget WITHOUT recording an event. Exported for tests.
 *
 * Read-only by design. A peek must never extend a window, so there is no
 * INSERT here — only expired-row cleanup and the COUNT.
 */
export async function tursoSlidingWindowPeek(
  client: Client,
  key: string,
  maxRequests: number,
  windowMs: number,
  opts: SlidingWindowOptions = {}
): Promise<{ limited: boolean; retryAfterMs: number }> {
  const now = opts.now ?? Date.now();
  const results = await client.batch(
    [
      {
        sql: "DELETE FROM rate_limit_events WHERE key = ? AND ts < ?",
        args: [key, now - windowMs],
      },
      {
        sql: "SELECT COUNT(*) AS count, MIN(ts) AS oldest FROM rate_limit_events WHERE key = ? AND ts >= ?",
        args: [key, now - windowMs],
      },
    ],
    "write"
  );
  const row = results[results.length - 1].rows[0] as unknown as
    | { count: number; oldest: number | null }
    | undefined;
  const count = Number(row?.count ?? 0);
  if (count >= maxRequests) {
    const oldest = row?.oldest == null ? null : Number(row.oldest);
    return { limited: true, retryAfterMs: oldest == null ? 0 : Math.max(0, oldest + windowMs - now) };
  }
  return { limited: false, retryAfterMs: 0 };
}

/** Delete every event for a key. Exported for tests. */
export async function tursoSlidingWindowClear(client: Client, key: string): Promise<void> {
  await client.batch([{ sql: "DELETE FROM rate_limit_events WHERE key = ?", args: [key] }], "write");
}

/**
 * Report whether a key is CURRENTLY over its budget, WITHOUT recording an
 * event.
 *
 * This exists for the login account layer, which must be able to refuse a
 * request *before* spending a bcrypt comparison. Charging the key up front
 * would penalise a correct password; checking only after a failure means a
 * correct password is never actually blocked — the attempt sails through while
 * the counter quietly grows — which is not a brute-force control at all.
 */
export async function peekRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: false } | { limited: true; retryAfterMs: number }> {
  const safeKey = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
  const now = Date.now();
  const client = getDb();

  if (client) {
    try {
      const result = await tursoSlidingWindowPeek(client, safeKey, maxRequests, windowMs);
      return result.limited
        ? { limited: true, retryAfterMs: result.retryAfterMs }
        : { limited: false };
    } catch {
      /* Fall through to the in-memory backstop, matching checkRateLimit: a
         limiter must never fail open. */
    }
  }

  pruneMemStore(now);
  const entry = memStore.get(safeKey);
  if (!entry || now > entry.resetAt) return { limited: false };
  if (entry.count >= maxRequests) return { limited: true, retryAfterMs: entry.resetAt - now };
  return { limited: false };
}

/**
 * Drop every recorded event for a key.
 *
 * Called after a SUCCESSFUL login so the account's failure history starts clean.
 * Without it, a user who fat-fingered their password a few times would stay one
 * or two attempts from a lockout, and a shared machine would carry one user's
 * failures into the next user's sign-in.
 */
export async function clearRateLimit(key: string): Promise<void> {
  const safeKey = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
  const client = getDb();

  if (client) {
    try {
      await tursoSlidingWindowClear(client, safeKey);
    } catch {
      /* Best effort: a stale counter is a lockout risk, not a security hole, so
         this must never fail the login it is cleaning up after. */
    }
  }
  memStore.delete(safeKey);
}

/* ── In-memory fallback store (local dev + Turso-outage backstop) ── */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

/** Hard ceiling on tracked keys, so a key flood can't grow memory without
 *  bound. */
const MEM_STORE_MAX_KEYS = 10_000;
/** Sweep expired windows at most this often (the per-call path stays O(1)). */
const MEM_PRUNE_INTERVAL_MS = 60_000;

let lastMemPrune = 0;

function pruneMemStore(now: number): void {
  if (now - lastMemPrune < MEM_PRUNE_INTERVAL_MS) return;
  lastMemPrune = now;

  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key);
  }
  /* Still at the cap: evict oldest-inserted keys (Map preserves insertion
     order) until there is room. Tracking the newest keys is the useful
     property; the map must never grow without bound. */
  while (memStore.size >= MEM_STORE_MAX_KEYS) {
    const oldest = memStore.keys().next();
    if (oldest.done) break;
    memStore.delete(oldest.value);
  }
}

/**
 * Resolve the client IP for coarse rate-limit keying.
 *
 * SECURITY: this no longer trusts a client-chosen header. It reads only the
 * header the deployment declares trusted (`TRUSTED_IP_HEADER`, e.g. the one
 * its proxy overwrites) and otherwise returns a single shared bucket. The old
 * behaviour — preferring `x-real-ip` and the rightmost `x-forwarded-for` —
 * let an attacker mint unlimited buckets by rotating those headers, which
 * silently disabled every rate limit in the app.
 *
 * The real brute-force control is the per-account layer (see
 * @/lib/rateLimitPolicy), which no header can influence.
 */
export function getClientIp(req: Request): string {
  return resolveClientIp(req.headers, process.env.TRUSTED_IP_HEADER);
}