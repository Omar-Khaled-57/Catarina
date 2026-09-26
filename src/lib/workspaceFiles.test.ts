import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import {
  abortUpload,
  chunkCountFor,
  collectFileRefs,
  commitUpload,
  createUpload,
  deleteOrphanedFiles,
  fileRefToId,
  getFile,
  normalizeFileId,
  saveChunk,
  sweepStaleUploads,
  UPLOAD_SESSION_TTL_MS,
  workspaceUsedBytes,
  type UploadStartData,
} from "./workspaceFiles";
import type { DemoProject } from "@/components/tools/drawers/types";

let db: Client;

async function freshDb(): Promise<Client> {
  const client = createClient({ url: ":memory:", intMode: "number" });
  await client.executeMultiple(`
    CREATE TABLE "WorkspaceUpload" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sectionKey" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "envelopeId" TEXT,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "mime" TEXT NOT NULL,
      "totalBytes" INTEGER NOT NULL,
      "chunkSize" INTEGER NOT NULL,
      "chunkCount" INTEGER NOT NULL,
      "createdBy" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE "WorkspaceUploadChunk" (
      "uploadId" TEXT NOT NULL,
      "chunkIndex" INTEGER NOT NULL,
      "data" BLOB NOT NULL,
      PRIMARY KEY ("uploadId", "chunkIndex")
    );
    CREATE TABLE "WorkspaceFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sectionKey" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "envelopeId" TEXT,
      "itemId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "mime" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "data" BLOB NOT NULL,
      "createdBy" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE "DrawerSection" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "tree" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 0
    );
  `);
  return client;
}

const startData = (over: Partial<UploadStartData> & { totalBytes: number }): UploadStartData => ({
  projectId: "proj-1",
  envelopeId: null,
  name: "clip.webm",
  type: "VIDEO",
  mime: "video/webm",
  createdBy: "user-1",
  ...over,
});

/** Insert a session directly with a small chunk size so multipart tests don't
 *  need 3MB buffers. */
async function injectSession(
  uploadId: string,
  totalBytes: number,
  chunkSize: number,
  createdAt = Date.now(),
) {
  const chunkCount = chunkCountFor(totalBytes, chunkSize);
  await db.execute(
    `INSERT INTO WorkspaceUpload
       (id, sectionKey, projectId, envelopeId, name, type, mime,
        totalBytes, chunkSize, chunkCount, createdBy, createdAt)
     VALUES (?, 'ART', 'proj-1', NULL, 'clip.webm', 'VIDEO', 'video/webm', ?, ?, ?, 'user-1', ?)`,
    [uploadId, totalBytes, chunkSize, chunkCount, createdAt],
  );
  return chunkCount;
}

before(async () => {
  db = await freshDb();
});
after(async () => {
  await db.close();
});

test("chunkCountFor rounds up and honors edge sizes", () => {
  assert.equal(chunkCountFor(0), 0);
  assert.equal(chunkCountFor(1, 4), 1);
  assert.equal(chunkCountFor(4, 4), 1);
  assert.equal(chunkCountFor(5, 4), 2);
  assert.equal(chunkCountFor(10, 4), 3);
  assert.equal(chunkCountFor(10 * 1024 * 1024), 4); // 10MB at 3MB parts
});

test("fileRefToId / normalizeFileId", () => {
  assert.equal(fileRefToId("file://abc-123-def"), "abc-123-def");
  assert.equal(fileRefToId("data:image/png;base64,AAAA"), null);
  assert.equal(fileRefToId(undefined), null);
  assert.equal(normalizeFileId("abc-123-def"), "abc-123-def");
  assert.equal(normalizeFileId("file://abc-123-def"), "abc-123-def");
  assert.equal(normalizeFileId("../../etc/passwd"), null);
  assert.equal(normalizeFileId("data:"), null);
});

test("createUpload plans the chunking and persists metadata", async () => {
  const plan = await createUpload(db, "ART", startData({ totalBytes: 10 * 1024 * 1024 }));
  assert.equal(plan.chunkCount, 4);
  assert.equal(plan.chunkSize, 3 * 1024 * 1024);
  const rows = await db.execute("SELECT totalBytes, chunkCount, chunkSize FROM WorkspaceUpload WHERE id = ?", [plan.uploadId]);
  const row = rows.rows[0];
  assert.equal(Number(row?.totalBytes), 10 * 1024 * 1024);
  assert.equal(Number(row?.chunkCount), 4);
});

test("single small file: one chunk, assembled and stored, session cleaned up", async () => {
  const { uploadId } = await createUpload(db, "ART", startData({ totalBytes: 3 }));
  const bytes = new Uint8Array([1, 2, 3]);
  const { received, chunkCount } = await saveChunk(db, uploadId, 0, bytes);
  assert.deepEqual([received, chunkCount], [1, 1]);

  const committed = await commitUpload(db, uploadId, "item-9");
  assert.equal(committed.fileId.length > 0, true);
  assert.equal(committed.itemId, "item-9");
  assert.equal(committed.size, 3);

  const stored = await getFile(db, committed.fileId);
  assert.ok(stored);
  assert.equal(Buffer.compare(stored.data, Buffer.from(bytes)), 0);
  assert.equal(stored.mime, "video/webm");

  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [uploadId])).rows[0]?.c, 0);
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?", [uploadId])).rows[0]?.c, 0);
});

test("multipart: chunks assemble back to the exact original bytes", async () => {
  const uploadId = "upload-multipart";
  await injectSession(uploadId, 10, 4); // 3 parts: 4 + 4 + 2
  const full = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

  await saveChunk(db, uploadId, 0, full.subarray(0, 4));
await saveChunk(db, uploadId, 1, full.subarray(4, 8));
      const rec = await saveChunk(db, uploadId, 2, full.subarray(8, 10));
  assert.deepEqual(rec, { received: 3, chunkCount: 3 });

  const committed = await commitUpload(db, uploadId, "item-mp");
  const stored = await getFile(db, committed.fileId);
  assert.ok(stored);
  assert.equal(stored.size, 10);
  assert.equal(Buffer.compare(stored.data, full), 0);

  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?", [uploadId])).rows[0]?.c, 0, "parts removed after commit");
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [uploadId])).rows[0]?.c, 0, "session removed after commit");
});

test("chunk validation: index, size and final-part length are enforced", async () => {
  const uploadId = "upload-validate";
  await injectSession(uploadId, 10, 4);

  await assert.rejects(() => saveChunk(db, uploadId, 5, new Uint8Array(4)), /Invalid chunk index/);
  await assert.rejects(() => saveChunk(db, uploadId, -1, new Uint8Array(4)), /Invalid chunk index/);
  await assert.rejects(() => saveChunk(db, uploadId, 3, new Uint8Array(4)), /Invalid chunk index/);
  // Non-final part must be exactly chunkSize.
  await assert.rejects(() => saveChunk(db, uploadId, 0, new Uint8Array(3)), /Unexpected chunk size/);
  await assert.rejects(() => saveChunk(db, uploadId, 0, new Uint8Array(5)), /Chunk is larger than allowed/);
  // Final part must be exactly the remainder.
  await assert.rejects(() => saveChunk(db, uploadId, 2, new Uint8Array(3)), /Unexpected final chunk size/);

  // A re-sent part replaces the previous one instead of duplicating.
  await saveChunk(db, uploadId, 0, new Uint8Array([9, 9, 9, 9]));
  await saveChunk(db, uploadId, 0, new Uint8Array([1, 2, 3, 4]));
  const parts = await db.execute("SELECT chunkIndex, data FROM WorkspaceUploadChunk WHERE uploadId = ?", [uploadId]);
  assert.equal(parts.rows.length, 1);
});

test("commitUpload rejects incomplete uploads", async () => {
  const uploadId = "upload-incomplete";
  await injectSession(uploadId, 10, 4);
  await saveChunk(db, uploadId, 0, new Uint8Array(4));
  await assert.rejects(() => commitUpload(db, uploadId, "item-x"), /Incomplete upload \(1 of 3 parts received\)/);
});

test("saveChunk rejects unknown sessions", async () => {
  await assert.rejects(() => saveChunk(db, "nope", 0, new Uint8Array(4)), /not found/);
  await assert.rejects(() => commitUpload(db, "nope", "item-x"), /not found/);
});

test("saveChunk / commitUpload refuse sessions from another section", async () => {
  const uploadId = "upload-xsection";
  await injectSession(uploadId, 10, 4); // created under ART

  await assert.rejects(
    () => saveChunk(db, uploadId, 0, new Uint8Array(4), "MARKETING"),
    /different section/,
  );
  await assert.rejects(
    () => commitUpload(db, uploadId, "item-xs", "MARKETING"),
    /different section/,
  );

  // The same calls are accepted when the expected section matches.
  await saveChunk(db, uploadId, 0, new Uint8Array(4), "ART");
  await assert.rejects(
    () => commitUpload(db, uploadId, "item-xs", "MARKETING"),
    /different section/,
  );
});

test("sweepStaleUploads removes abandoned sessions and their parts only", async () => {
  const oldId = "upload-old";
  const chunkCount = await injectSession(oldId, 10, 4, Date.now() - UPLOAD_SESSION_TTL_MS - 1000);
  for (let i = 0; i < chunkCount; i++) {
    const size = i === chunkCount - 1 ? 10 - (chunkCount - 1) * 4 : 4;
    await saveChunk(db, oldId, i, new Uint8Array(size));
  }

  const freshId = "upload-fresh";
  await injectSession(freshId, 10, 4);
  await saveChunk(db, freshId, 0, new Uint8Array(4));

  await sweepStaleUploads(db);

  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [oldId])).rows[0]?.c, 0);
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?", [oldId])).rows[0]?.c, 0);
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [freshId])).rows[0]?.c, 1);
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?", [freshId])).rows[0]?.c, 1);
});

test("collectFileRefs walks the whole tree and only picks file references", () => {
  const tree: DemoProject[] = [
    {
      id: "p1",
      name: "Drawer",
      items: [
        { id: "a", type: "LINK", name: "url", content: "https://example.com" },
        { id: "b", type: "FILE", name: "blob", content: "file://11111111-1111-1111-1111-111111111111" },
      ],
      envelopes: [
        {
          id: "e1",
          name: "Env",
          items: [
            { id: "c", type: "IMAGE", name: "img", content: "file://22222222-2222-2222-2222-222222222222" },
            { id: "d", type: "NOTE", name: "note", content: undefined },
            { id: "e", type: "CODE", name: "data", content: "data:text/plain;base64,AAA" },
          ],
        },
      ],
    },
  ];
  assert.deepEqual(
    [...collectFileRefs(tree)].sort(),
    [
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111",
    ].sort(),
  );
  assert.equal(collectFileRefs([]).size, 0);
});

test("deleteOrphanedFiles purges blobs nothing references (real delete)", async () => {
  const storeFile = async () => {
    const { uploadId } = await createUpload(db, "ART", startData({ totalBytes: 3 }));
    await saveChunk(db, uploadId, 0, new Uint8Array([1, 2, 3]));
    return (await commitUpload(db, uploadId, "item-x")).fileId;
  };
  const keptId = await storeFile();
  const orphanId = await storeFile();
  const before = await db.execute("SELECT COUNT(*) AS c FROM WorkspaceFile");
  const storedBefore = Number(before.rows[0]?.c ?? 0);

  /* Everything except keptId is unreferenced (other tests' files too). */
  const deleted = await deleteOrphanedFiles(db, "ART", new Set([keptId]));
  assert.equal(deleted, storedBefore - 1);
  assert.ok(await getFile(db, keptId), "referenced file survives");
  assert.equal(await getFile(db, orphanId), null, "orphaned file is gone");

  assert.equal(await deleteOrphanedFiles(db, "ART", new Set([keptId])), 0, "idempotent");
});

test("workspaceUsedBytes counts stored blobs and tree JSON together", async () => {
  const id1 = (await createUpload(db, "ART", startData({ totalBytes: 3 }))).uploadId;
  await saveChunk(db, id1, 0, new Uint8Array([1, 2, 3]));
  await commitUpload(db, id1, "item-a");

  const id2 = (await createUpload(db, "ART", startData({ totalBytes: 5 }))).uploadId;
  await saveChunk(db, id2, 0, new Uint8Array([1, 2, 3, 4, 5]));
  await commitUpload(db, id2, "item-b");

  await db.execute(
    `INSERT INTO DrawerSection (key, tree, version) VALUES ('ART', '{"tree":42}', 1)`,
  );

  const used = await workspaceUsedBytes(db);

  // Matches the two SUM queries it is built from (shared test DB already holds
  // files from earlier tests, so recompute rather than hardcode).
  const [f, t] = await Promise.all([
    db.execute("SELECT COALESCE(SUM(size), 0) AS s FROM WorkspaceFile"),
    db.execute("SELECT COALESCE(SUM(LENGTH(tree)), 0) AS s FROM DrawerSection"),
  ]);
  assert.equal(used, Number(f.rows[0]?.s ?? 0) + Number(t.rows[0]?.s ?? 0));
  // …and the three contributions this test itself added are counted.
  assert.ok(used >= 3 + 5 + '{"tree":42}'.length);
});

test("abortUpload drops a session and its parts, and is owner-checked", async () => {
  const uploadId = "upload-abort";
  await injectSession(uploadId, 10, 4);
  await saveChunk(db, uploadId, 0, new Uint8Array(4));

  await assert.rejects(
    () => abortUpload(db, uploadId, "someone-else"),
    /Not your upload/,
  );
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [uploadId])).rows[0]?.c, 1, "foreign abort must not delete");

  await abortUpload(db, uploadId, "user-1");
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id = ?", [uploadId])).rows[0]?.c, 0);
  assert.equal((await db.execute("SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?", [uploadId])).rows[0]?.c, 0);
});
/* ── ownership of an in-flight upload ──────────────────────────────────── */

test("saveChunk refuses a teammate's upload, not just another section's", async () => {
  // Section membership is not ownership: a peer in the SAME section must not be
  // able to append parts to someone else's in-flight upload.
  const uploadId = "upload-chunk-owner";
  await injectSession(uploadId, 8, 4);

  await assert.rejects(
    () => saveChunk(db, uploadId, 0, new Uint8Array(4), "ART", "someone-else"),
    /Not your upload/,
  );
  const chunks = await db.execute(
    "SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?",
    [uploadId],
  );
  assert.equal(chunks.rows[0]?.c, 0, "a rejected chunk must not be stored");

  // The owner is still able to write it.
  const ok = await saveChunk(db, uploadId, 0, new Uint8Array(4), "ART", "user-1");
  assert.equal(ok.received, 1);
});

test("commitUpload refuses a teammate's upload", async () => {
  // Completing an upload links the assembled blob into a project, so it must be
  // restricted to the session's author.
  const uploadId = "upload-complete-owner";
  await injectSession(uploadId, 8, 4);
  await saveChunk(db, uploadId, 0, new Uint8Array(4), "ART", "user-1");
  await saveChunk(db, uploadId, 1, new Uint8Array(4), "ART", "user-1");

  await assert.rejects(
    () => commitUpload(db, uploadId, "item-1", "ART", "someone-else"),
    /Not your upload/,
  );
  const files = await db.execute(
    "SELECT COUNT(*) AS c FROM WorkspaceFile WHERE itemId = ?",
    ["item-1"],
  );
  assert.equal(files.rows[0]?.c, 0, "a rejected commit must not create a file");

  const committed = await commitUpload(db, uploadId, "item-1", "ART", "user-1");
  assert.equal(committed.itemId, "item-1");
});

test("the owner check is opt-in so existing internal callers keep working", async () => {
  // Only the HTTP handlers pass a userId; omitting it must not lock anyone out.
  const uploadId = "upload-no-user";
  await injectSession(uploadId, 4, 4);
  const ok = await saveChunk(db, uploadId, 0, new Uint8Array(4), "ART");
  assert.equal(ok.received, 1);
});

/* ── bound-variable batching ──────────────────────────────────────────── */

/**
 * A client that enforces a LOW variable cap, standing in for an older SQLite
 * build (999 bound variables). Modern libSQL allows 32,766, so simply inserting
 * "a lot" of rows would NOT exercise the bug — this makes the ceiling real so
 * the batching is genuinely required.
 *
 * It also records the widest statement it saw, so the test can assert the work
 * really was split rather than merely succeeding.
 */
function cappedClient(inner: Client, cap: number) {
  const seen = { widest: 0 };
  const check = (args: unknown[]) => {
    seen.widest = Math.max(seen.widest, Array.isArray(args) ? args.length : 0);
    if (Array.isArray(args) && args.length > cap) {
      throw new Error("too many SQL variables");
    }
  };
  const proxy = {
    execute: (sql: string, args?: unknown) => {
      check(Array.isArray(args) ? args : []);
      return inner.execute(sql, (args ?? []) as never);
    },
    batch: (stmts: { sql: string; args?: unknown }[], mode?: string) => {
      for (const st of stmts) check((st.args ?? []) as unknown[]);
      return inner.batch(stmts as never, mode as never);
    },
  } as unknown as Client;
  return { proxy, seen };
}

test("sweepStaleUploads batches instead of binding every stale id at once", async () => {
  // Regression: the sweep built ONE `IN (?, ?, …)` list, so on a build with a
  // 999-variable ceiling it threw "too many SQL variables" the moment a
  // thousand sessions piled up — which silently disabled chunked uploads for
  // everyone. The cap here reproduces that ceiling.
  const COUNT = 1_200;
  const createdAt = Date.now() - UPLOAD_SESSION_TTL_MS - 60_000;
  for (let i = 0; i < COUNT; i++) {
    await db.execute(
      `INSERT INTO WorkspaceUpload
         (id, sectionKey, projectId, envelopeId, name, type, mime,
          totalBytes, chunkSize, chunkCount, createdBy, createdAt)
       VALUES (?, 'ART', 'proj-1', NULL, 'f.bin', 'FILE', 'application/octet-stream', 4, 4, 1, 'user-1', ?)`,
      [`bulk-${i}`, createdAt],
    );
  }

  const { proxy, seen } = cappedClient(db, 999);
  await sweepStaleUploads(proxy);

  assert.ok(seen.widest <= 999, `widest statement bound ${seen.widest} variables`);
  assert.ok(
    seen.widest < COUNT,
    `expected the work to be split, but one statement bound ${seen.widest} ids`,
  );
  const left = await db.execute(
    "SELECT COUNT(*) AS c FROM WorkspaceUpload WHERE id LIKE 'bulk-%'",
  );
  assert.equal(Number(left.rows[0]?.c ?? -1), 0, "every stale session must be swept");
});

test("deleteOrphanedFiles batches instead of binding every orphan at once", async () => {
  const COUNT = 1_100;
  for (let i = 0; i < COUNT; i++) {
    await db.execute(
      `INSERT INTO WorkspaceFile
         (id, sectionKey, projectId, envelopeId, itemId, name, mime, size, data, createdBy, createdAt)
       VALUES (?, 'ART', 'proj-1', NULL, ?, 'f.bin', 'application/octet-stream', 1, x'00', 'user-1', 0)`,
      [`orphan-${i}`, `item-${i}`],
    );
  }

  // None referenced, so all are orphans. Earlier tests in this shared database
  // may leave their own unreferenced rows behind, so the row check is scoped.
  const { proxy, seen } = cappedClient(db, 999);
  const deleted = await deleteOrphanedFiles(proxy, "ART", new Set<string>());

  assert.ok(seen.widest <= 999, `widest statement bound ${seen.widest} variables`);
  assert.ok(seen.widest < COUNT, "expected the purge to be split into batches");
  assert.ok(deleted >= COUNT, `expected at least ${COUNT} deletions, got ${deleted}`);
  const left = await db.execute(
    "SELECT COUNT(*) AS c FROM WorkspaceFile WHERE id LIKE 'orphan-%'",
  );
  assert.equal(Number(left.rows[0]?.c ?? -1), 0);
});
