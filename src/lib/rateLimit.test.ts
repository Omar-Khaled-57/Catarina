import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import {
  tursoSlidingWindowCheck,
  tursoSlidingWindowPeek,
  tursoSlidingWindowClear,
  SWEEP_MARGIN_MS,
} from "./rateLimit";
import { randomUUID } from "node:crypto";

/** Longest window any caller uses: login's per-account layer. */
const LONGEST_WINDOW_MS = 15 * 60_000;

let db: Client;

async function freshDb(): Promise<Client> {
  const client = createClient({ url: ":memory:", intMode: "number" });
  await client.executeMultiple(`
    CREATE TABLE rate_limit_events (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL,
      "ts" INTEGER NOT NULL
    );
    CREATE INDEX rate_limit_events_key_ts_idx ON rate_limit_events ("key", "ts");
    CREATE INDEX rate_limit_events_ts_idx ON rate_limit_events ("ts");
  `);
  return client;
}

async function countRows(key?: string): Promise<number> {
  const sql = key
    ? { sql: "SELECT COUNT(*) AS c FROM rate_limit_events WHERE key = ?", args: [key] }
    : { sql: "SELECT COUNT(*) AS c FROM rate_limit_events", args: [] };
  const res = await db.execute(sql);
  return Number(res.rows[0]?.c ?? 0);
}

function check(key: string, max: number, windowMs: number, now: number, opts?: { forceSweep?: boolean }) {
  return tursoSlidingWindowCheck(db, key, max, windowMs, { now, forceSweep: opts?.forceSweep });
}

before(async () => {
  db = await freshDb();
});
after(async () => {
  await db.close();
});

test("allows up to max requests inside the window", async () => {
  const key = `test:${randomUUID()}`;
  const max = 3;
  const windowMs = 60_000;

  assert.equal((await check(key, max, windowMs, 0)).limited, false);
  assert.equal((await check(key, max, windowMs, 1_000)).limited, false);
  assert.equal((await check(key, max, windowMs, 2_000)).limited, false);

  const r4 = await check(key, max, windowMs, 3_000);
  assert.equal(r4.limited, true);
  assert.ok(r4.retryAfterMs > 0);
});

test("true sliding window: frees as the oldest event ages out, no fixed boundary", async () => {
  const key = `test:${randomUUID()}`;
  const max = 2;
  const windowMs = 1_000;

  // Attempts at 0, 200, 400 — third is blocked.
  assert.equal((await check(key, max, windowMs, 0)).limited, false);
  assert.equal((await check(key, max, windowMs, 200)).limited, false);
  assert.equal((await check(key, max, windowMs, 400)).limited, true);

  // At t=1001 only the t=0 event has left the window; 200 + 400 + 1001 = 3 → still blocked.
  assert.equal((await check(key, max, windowMs, 1_001)).limited, true);

  // At t=1401 the t=400 event exits: in-window is now 1001 + 1401 = 2 → allowed.
  // Sliding semantics free it the instant an event ages out, not at a
  // fixed-window boundary.
  assert.equal((await check(key, max, windowMs, 1_401)).limited, false);
});

test("per-key isolation", async () => {
  const keyA = `test:${randomUUID()}`;
  const keyB = `test:${randomUUID()}`;
  const keyC = `test:${randomUUID()}`;
  const max = 1;
  const windowMs = 60_000;

  assert.equal((await check(keyA, max, windowMs, 0)).limited, false);
  assert.equal((await check(keyA, max, windowMs, 0)).limited, true); // 2nd within window
  assert.equal((await check(keyA, max, windowMs, 0)).limited, true); // 3rd → still blocked
  // Untouched keys are unaffected by keyA's activity.
  assert.equal((await check(keyB, max, windowMs, 0)).limited, false);
  assert.equal((await check(keyC, max, windowMs, 0)).limited, false);
});

test("blocked attempts are recorded and age out (no lock-in)", async () => {
  const key = `test:${randomUUID()}`;
  const max = 2;
  const windowMs = 60_000;

  await check(key, max, windowMs, 0);
  await check(key, max, windowMs, 0);
  await check(key, max, windowMs, 1_000); // 3rd → blocked
  assert.equal((await check(key, max, windowMs, 1_000)).limited, true); // 4th → blocked

  // At t=60_000 the window still contains all four prior events → blocked.
  assert.equal((await check(key, max, windowMs, 60_000)).limited, true);

  // At t=61_001 both t=1_000 events exit the window; the t=60_000 blocked
  // attempt is still in-window → allowed again, and the per-key sweep removed
  // only the stale rows.
  const at = await check(key, max, windowMs, 61_001);
  assert.equal(at.limited, false);
  assert.equal(await countRows(key), 2); // t=60,000 stuck attempt + current
});

test("throttled global sweep clears abandoned rows for all keys", async () => {
  const abandoned = `test:abandoned-${randomUUID()}`;
  const now = 50_000_000;
  const stale = now - SWEEP_MARGIN_MS - 1_000;

  await db.execute("INSERT INTO rate_limit_events (id, key, ts) VALUES (?, ?, ?)", [randomUUID(), abandoned, stale]);
  await db.execute("INSERT INTO rate_limit_events (id, key, ts) VALUES (?, ?, ?)", [randomUUID(), abandoned, stale + 1]);

  await check(`test:${randomUUID()}`, 5, 5_000, now, { forceSweep: true });

  assert.equal(
    await countRows(abandoned),
    0,
    "global sweep should delete rows older than now - SWEEP_MARGIN_MS across all keys"
  );
});

test("global sweep never removes in-window events (retention >= longest window)", async () => {
  const key = `test:${randomUUID()}`;
  const windowMs = LONGEST_WINDOW_MS;
  const max = 2;

  assert.ok(
    SWEEP_MARGIN_MS > windowMs,
    `SWEEP_MARGIN_MS (${SWEEP_MARGIN_MS}) must exceed the longest window (${windowMs})`,
  );

  await check(key, max, windowMs, 1_000);
  await check(key, max, windowMs, 2_000);

  // 12 minutes later both events are still inside the 15-minute window, but
  // they are older than the old 10-minute sweep margin — so this check fails if
  // the margin is ever lowered again.
  const now = 12 * 60_000;
  const r = await check(key, max, windowMs, now, { forceSweep: true });
  assert.equal(r.limited, true); // 2 old + current → 3rd attempt blocked
  assert.equal(await countRows(key), 3); // 2 old + current — nothing swept
});

test("retryAfterMs is measured from the oldest in-window event", async () => {
  const key = `test:${randomUUID()}`;
  const windowMs = 10_000;
  const max = 5;

  for (let i = 0; i < max; i++) {
    await check(key, max, windowMs, i * 100);
  }
  const now = (max - 1) * 100 + 1; // 401 — 6th attempt, events at 0..400
  const r = await check(key, max, windowMs, now);
  assert.equal(r.limited, true);
  assert.equal(r.retryAfterMs, windowMs - now); // oldest (0) + window - now
});
/* ─── peek / clear: the login account layer's primitives ──────────────────────
 * The account layer must be able to refuse a request BEFORE spending a bcrypt
 * comparison, and a correct password must never consume budget. That needs a
 * read-only peek plus a way to clear the history on success.
 * ─────────────────────────────────────────────────────────────────────────── */

test("peek reports the window state without recording an event", async () => {
  const key = `peek-${randomUUID()}`;
  const max = 3;
  const now = Date.now();
  for (let i = 0; i < max - 1; i++) {
    await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  }
  const before = await countRows(key);
  assert.equal(before, max - 1, "setup should be below the failure budget");

  // Below the budget, peeking allows the next attempt without growing it.
  for (let i = 0; i < 5; i++) {
    const r = await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, {
      now,
      forceSweep: false,
    });
    assert.equal(r.limited, false, "below the budget should be allowed");
  }
  assert.equal(await countRows(key), before, "peek inserted events");

  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  const atBudget = await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, {
    now,
    forceSweep: false,
  });
  assert.equal(atBudget.limited, true, "the next comparison must be blocked at the budget");
  assert.equal(await countRows(key), max, "peek inserted an event at the budget");
});

test("peek reports limited once failures exceed the budget", async () => {
  const key = `peek-over-${randomUUID()}`;
  const max = 2;
  const now = Date.now();
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });

  const r = await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, {
    now,
    forceSweep: false,
  });
  assert.equal(r.limited, true, "a correct guess must be blocked after the budget is spent");
  assert.ok(r.retryAfterMs > 0, "a blocked attempt should say when to retry");
});

test("peek ignores events that have fallen out of the window", async () => {
  const key = `peek-old-${randomUUID()}`;
  const max = 1;
  const t0 = Date.now();
  await check(key, max, LONGEST_WINDOW_MS, t0, { forceSweep: false });
  await check(key, max, LONGEST_WINDOW_MS, t0, { forceSweep: false });
  const blocked = await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, {
    now: t0,
    forceSweep: false,
  });
  assert.equal(blocked.limited, true);

  // Long after the window, the same key is clean again.
  const later = await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, {
    now: t0 + LONGEST_WINDOW_MS + 1,
    forceSweep: false,
  });
  assert.equal(later.limited, false, "stale failures kept the account locked");
});

test("peek on an unknown key is not limited", async () => {
  const r = await tursoSlidingWindowPeek(db, `never-seen-${randomUUID()}`, 1, LONGEST_WINDOW_MS, {
    now: Date.now(),
    forceSweep: false,
  });
  assert.equal(r.limited, false);
});

test("clear drops a key's history so a success resets the budget", async () => {
  const key = `clear-${randomUUID()}`;
  const max = 2;
  const now = Date.now();
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await check(key, max, LONGEST_WINDOW_MS, now, { forceSweep: false });
  assert.equal(
    (await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, { now, forceSweep: false }))
      .limited,
    true,
  );

  await tursoSlidingWindowClear(db, key);
  assert.equal(await countRows(key), 0, "clear left rows behind");
  assert.equal(
    (await tursoSlidingWindowPeek(db, key, max, LONGEST_WINDOW_MS, { now, forceSweep: false }))
      .limited,
    false,
    "a successful sign-in must reset the failure history",
  );
});

test("clear only affects the named key", async () => {
  const a = `clear-a-${randomUUID()}`;
  const b = `clear-b-${randomUUID()}`;
  const now = Date.now();
  await check(a, 1, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await check(b, 1, LONGEST_WINDOW_MS, now, { forceSweep: false });
  await tursoSlidingWindowClear(db, a);
  assert.equal(await countRows(a), 0);
  assert.equal(await countRows(b), 1, "clear reached another key's rows");
});
