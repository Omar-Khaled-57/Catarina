/**
 * Rate Limiter — Upstash Redis sliding window for production,
 * falls back to in-memory for local dev when Upstash isn't configured.
 *
 * How it works (production):
 *   1. Request arrives → getClientIp extracts IP from x-forwarded-for
 *   2. checkRateLimit(key, max, window) → creates a Ratelimit instance
 *   3. Ratelimit calls Upstash Redis REST API (not TCP — works in serverless)
 *   4. Redis stores a sorted set of timestamps per key (e.g. "login:192.168.1.1")
 *   5. Sliding window counts how many requests exist in the last N ms
 *   6. If over limit → returns { limited: true, retryAfterMs }
 *   7. If under limit → increments counter, returns { limited: false }
 *
 * Why this matters on Vercel:
 *   Each serverless function invocation can be a NEW cold start with empty memory.
 *   The old in-memory Map reset on every cold start, so a brute-force attacker
 *   hitting 1000 requests would get 1000 fresh maps — rate limit never triggered.
 *   Upstash Redis lives outside Vercel, so ALL instances share the same counter.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/* ── Shared Redis client (lazy singleton) ─────────────── */
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Check rate limit for a given key (typically IP-prefixed).
 * Returns { limited: true, retryAfterMs } if rate limit exceeded.
 *
 * In production (Upstash): uses Redis sorted sets — shared across all Vercel instances.
 * In local dev (no Upstash env vars): falls back to in-memory Map per instance.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: false } | { limited: true; retryAfterMs: number }> {
  const redisClient = getRedis();

  /* ── Upstash path ──────────────────────────────────── */
  if (redisClient) {
    // Convert window from ms to a human-readable string for Upstash
    const windowSec = Math.ceil(windowMs / 1000);

    const limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
      analytics: false,
      prefix: `catarina:${key.split(":")[0]}`, // prefix by route type (login, register, etc.)
    });

    const result = await limiter.limit(key);

    if (!result.success) {
      const retryAfterMs = Math.max(0, result.reset - Date.now());
      return { limited: true, retryAfterMs };
    }

    return { limited: false };
  }

  /* ── In-memory fallback (local dev) ────────────────── */
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
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

/** Get client IP from request headers */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
