-- Reconcile the rate-limiter table name with the runtime SQL.
-- The scaffolded "cloud_drawers" migration dropped `rate_limit_events` and
-- created `RateLimitEvent`, but src/lib/rateLimit.ts always queries the literal
-- table `rate_limit_events` — so the app-wide limiter (login/register/goals/
-- uploads/drawers) was silently fail-open wherever that migration landed.
-- This migration is idempotent and safe on either side of that fork:
--   * creates `rate_limit_events` only if it is missing (matches the original
--     20260906000000_add_rate_limit DDL),
--   * drops the stray `RateLimitEvent` if present (it only holds ephemeral
--     sliding-window counter rows — no steady-state value).
CREATE TABLE IF NOT EXISTS "rate_limit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_events_key_ts_idx" ON "rate_limit_events"("key", "ts");
CREATE INDEX IF NOT EXISTS "rate_limit_events_ts_idx" ON "rate_limit_events"("ts");

DROP TABLE IF EXISTS "RateLimitEvent";