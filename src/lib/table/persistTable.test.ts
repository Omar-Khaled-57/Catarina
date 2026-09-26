import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  persistTable,
  REBASE_MESSAGE,
  CONFLICT_MESSAGE,
  OFFLINE_MESSAGE,
  type TableSaveDoc,
} from "@/lib/table/persistTable";

/* ─── Harness ────────────────────────────────────────────────────────────────
 * A fake server plus a tiny document store, so the tests can assert the exact
 * sequence of requests and the state the caller was left in.
 * ─────────────────────────────────────────────────────────────────────────── */

type Reply = { status: number; body?: unknown };

function makeDoc(overrides: Partial<TableSaveDoc> = {}): TableSaveDoc {
  return {
    id: "t1",
    name: "Plan",
    color: "#fff",
    isDateBased: false,
    cells: { rows: [], cols: 3 },
    stickers: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface Server {
  fetchImpl: typeof fetch;
  /** Every PATCH body received, in order. */
  sends: { token: unknown; cells: unknown }[];
  /** Queue of `updatedAt` stamps; one queued stamp makes the next PATCH 409. */
  conflicts: string[];
}

function makeServer(replies: Reply[]): Server {
  const sends: Server["sends"] = [];
  const conflicts: string[] = [];
  let patch = 0;
  // The revision the "peer" reports for the most recent conflict.
  let peerStamp = "peer-1";
  const server: Server = {
    sends,
    conflicts,
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        sends.push({ token: body.expectedUpdatedAt, cells: body.cells });
        if (server.conflicts.length > 0) {
          peerStamp = server.conflicts.shift() as string;
          return new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
        }
        const reply = replies[Math.min(patch++, replies.length - 1)];
        return new Response(
          JSON.stringify(reply.body ?? { table: { updatedAt: `rev-${patch}` } }),
          { status: reply.status },
        );
      }
      // GET: the peer's current revision
      return new Response(JSON.stringify({ table: { id: "t1", cells: {}, updatedAt: peerStamp } }), {
        status: 200,
      });
    }) as unknown as typeof fetch,
  };
  return server;
}

/** Wires a document store the way the hook does. */
function makeStore(initial: TableSaveDoc) {
  let doc = initial;
  return {
    getDoc: () => doc,
    /** Lets a test simulate an edit landing while a request is in flight. */
    mutate: (fn: (d: TableSaveDoc) => TableSaveDoc) => {
      doc = fn(doc);
    },
    peek: () => doc,
  };
}

function run(store: ReturnType<typeof makeStore>, server: Server, maxAttempts?: number) {
  const adopted: string[] = [];
  return persistTable({
    getDoc: store.getDoc,
    adoptToken: (t) => {
      adopted.push(t);
      store.mutate((d) => ({ ...d, updatedAt: t }));
    },
    isCancelled: () => false,
    fetchImpl: server.fetchImpl,
    ...(maxAttempts === undefined ? {} : { maxAttempts }),
  }).then((outcome) => ({ outcome, adopted, final: store.peek() }));
}

/* ─── The token must advance after every accepted write ──────────────────── */

describe("persistTable adopts the server's new CAS token", () => {
  test("a second save sends the token the first save returned", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([
      { status: 200, body: { table: { updatedAt: "rev-2" } } },
      { status: 200, body: { table: { updatedAt: "rev-3" } } },
    ]);

    const first = await run(store, server);
    assert.equal(first.outcome.status, "saved");
    assert.equal(first.final.updatedAt, "rev-2");
    assert.deepEqual(server.sends[0].token, "2026-01-01T00:00:00.000Z");

    // The regression: this used to resend the ORIGINAL token, so the server
    // rejected the client's own second write with a 409.
    const second = await run(store, server);
    assert.equal(second.outcome.status, "saved");
    assert.equal(server.sends[1].token, "rev-2", "second save replayed a stale token");
    assert.equal(second.final.updatedAt, "rev-3");
  });

  test("a null token is sent as null so the server fails closed", async () => {
    const store = makeStore(makeDoc({ updatedAt: null }));
    const server = makeServer([{ status: 400, body: { error: "expectedUpdatedAt required" } }]);
    const { outcome } = await run(store, server);
    assert.equal(server.sends[0].token, null);
    assert.equal(outcome.status, "rejected");
  });
});

/* ─── 409 handling ───────────────────────────────────────────────────────── */

describe("persistTable rebases on conflict without losing local edits", () => {
  test("a conflict retries once with the peer's token and reports the rebase", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 200, body: { table: { updatedAt: "mine-2" } } }]);
    server.conflicts = ["peer-9"];

    const { outcome, final } = await run(store, server);
    assert.equal(outcome.status, "rebased");
    assert.equal(outcome.status === "rebased" ? outcome.message : "", REBASE_MESSAGE);
    assert.equal(server.sends.length, 2, "expected exactly one retry");
    assert.deepEqual(server.sends[0].token, "2026-01-01T00:00:00.000Z");
    assert.equal(server.sends[1].token, "peer-9", "retry did not carry the peer's token");
    assert.equal(final.updatedAt, "mine-2");
  });

  test("local edits survive a conflict", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 200, body: { table: { updatedAt: "mine-2" } } }]);
    server.conflicts = ["peer-9"];

    // Simulate typing while the first request is in flight.
    store.mutate((d) => ({ ...d, cells: { rows: [["typed"]], cols: 3 } }));

    const { final } = await run(store, server);
    assert.deepEqual(
      final.cells,
      { rows: [["typed"]], cols: 3 },
      "the rebase overwrote unsaved local work with the server copy",
    );
  });

  test("a repeatedly-conflicting table stops after one retry", async () => {
    const store = makeStore(makeDoc());
    // Every PATCH 409s, and the GET always reports a newer revision.
    const alwaysConflict = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return new Response("{}", { status: 409 });
      return new Response(JSON.stringify({ table: { updatedAt: `peer-${Math.random()}` } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const outcome = await persistTable({
      getDoc: store.getDoc,
      adoptToken: (t) => store.mutate((d) => ({ ...d, updatedAt: t })),
      isCancelled: () => false,
      fetchImpl: alwaysConflict,
    });
    assert.equal(outcome.status, "conflict");
    assert.equal(outcome.status === "conflict" ? outcome.message : "", CONFLICT_MESSAGE);
  });

  test("maxAttempts: 1 never retries", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 200, body: { table: { updatedAt: "x" } } }]);
    server.conflicts = ["peer-1"];
    const { outcome } = await run(store, server, 1);
    assert.equal(outcome.status, "conflict");
    assert.equal(server.sends.length, 1, "retried despite maxAttempts: 1");
  });
});

/* ─── Failure modes ──────────────────────────────────────────────────────── */

describe("persistTable reports why a save failed", () => {
  test("surfaces the server's own rejection reason", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 400, body: { error: "Cell text is too long" } }]);
    const { outcome } = await run(store, server);
    assert.equal(outcome.status, "rejected");
    assert.equal(outcome.status === "rejected" ? outcome.message : "", "Cell text is too long");
  });

  test("a 429 tells the user a retry is needed rather than claiming success", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 429, body: { error: "Too many requests" } }]);
    const { outcome } = await run(store, server);
    assert.equal(outcome.status, "rejected");
    assert.match(
      outcome.status === "rejected" ? outcome.message : "",
      /wait a moment/i,
    );
  });

  test("a network failure is reported as offline, not as a rejection", async () => {
    const store = makeStore(makeDoc());
    const boom = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const outcome = await persistTable({
      getDoc: store.getDoc,
      adoptToken: () => {},
      isCancelled: () => false,
      fetchImpl: boom,
    });
    assert.equal(outcome.status, "offline");
    assert.equal(outcome.status === "offline" ? outcome.message : "", OFFLINE_MESSAGE);
  });

  test("an unmounted editor does not touch state", async () => {
    const store = makeStore(makeDoc());
    const server = makeServer([{ status: 200, body: { table: { updatedAt: "rev-2" } } }]);
    const outcome = await persistTable({
      getDoc: store.getDoc,
      adoptToken: () => assert.fail("must not adopt a token after unmount"),
      isCancelled: () => true,
      fetchImpl: server.fetchImpl,
    });
    assert.equal(outcome.status, "cancelled");
  });

  test("no document means there is nothing to save", async () => {
    const outcome = await persistTable({
      getDoc: () => null,
      adoptToken: () => assert.fail("must not adopt a token"),
      isCancelled: () => false,
      fetchImpl: (() => assert.fail("must not fetch")) as unknown as typeof fetch,
    });
    assert.equal(outcome.status, "cancelled");
  });
});
