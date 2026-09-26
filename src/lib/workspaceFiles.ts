/**
 * Drawer file uploads — chunked upload of large files into the shared Turso
 * workspace, assembled server-side.
 *
 * Why chunks:
 *   Vercel serverless functions reject request bodies over ~4.5MB (413). So a
 *   single base64 upload tops out around 3MB of raw file. Anything bigger is
 *   split into UPLOAD_CHUNK_BYTES raw-byte parts on the client; each part is
 *   base64 inside its own mutation request (≈4MB of JSON, under the cap) and
 *   stored verbatim in WorkspaceUploadChunk. Once every part has arrived,
 *   commitUpload() concatenates them back into the original bytes, persists
 *   them as one WorkspaceFile BLOB, and the drawer tree item content becomes a
 *   `file://<fileId>` reference. The tree JSON therefore stays small on every
 *   read — only the reference travels, not the media.
 *
 * Handled via the raw @libsql/client (not Prisma), mirroring rate_limit_events:
 * Prisma owns the DDL only. Functions that touch the DB take the client as an
 * argument so tests can use an in-memory store.
 */

import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { DemoProject } from "@/components/tools/drawers/types";

/** Raw-byte size of one upload part (client slices the file to this). */
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024; // 3 MB

/** Hard ceiling for a single workspace file. */
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB

/** Hard ceiling for the shared store ACROSS ALL sections. Bounds the Turso DB
 *  (free tier holds ≈5GB) so the rest of the app's data keeps headroom and one
 *  section can't fill the whole workspace. */
export const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

/** Abandoned sessions (no complete after this long) are swept on next start. */
export const UPLOAD_SESSION_TTL_MS = 60 * 60_000; // 1 hour

/** Tree content marker for an assembled workspace file. */
export const FILE_REF_PREFIX = "file://";

export const WORKSPACE_FILE_TYPES = [
  "CODE",
  "IMAGE",
  "FILE",
  "LINK",
  "NOTE",
  "VIDEO",
] as const;

export type WorkspaceFileType = (typeof WORKSPACE_FILE_TYPES)[number];

/* ── Shared Turso client (lazy singleton, same pattern as rateLimit) ── */
let db: Client | null = null;

export function getUploadStore(): Client | null {
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

/* ── Pure helpers ─────────────────────────────────────────────────────────── */

/** Number of parts a file of `size` bytes breaks into. */
export function chunkCountFor(size: number, chunkSize = UPLOAD_CHUNK_BYTES): number {
  const ceil = Math.ceil(size / chunkSize);
  return ceil > 0 ? ceil : 0;
}

/** `file://<id>` → `<id>`, or null when the content isn't a file reference. */
export function fileRefToId(content: string | undefined | null): string | null {
  if (typeof content !== "string") return null;
  if (!content.startsWith(FILE_REF_PREFIX)) return null;
  return normalizeFileId(content.slice(FILE_REF_PREFIX.length));
}

/** Accepts either a bare id or a `file://<id>` reference and returns the id. */
export function normalizeFileId(value: string | undefined | null): string | null {
  if (typeof value !== "string" || !value) return null;
  const id = value.startsWith(FILE_REF_PREFIX)
    ? value.slice(FILE_REF_PREFIX.length)
    : value;
  // Refs are server-generated UUIDs — reject anything weird defensively.
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

export function isWorkspaceFileType(value: unknown): value is WorkspaceFileType {
  return (
    typeof value === "string" &&
    (WORKSPACE_FILE_TYPES as readonly string[]).includes(value)
  );
}

/** Every `file://<id>` reference anywhere in a section tree (optionally only
 *  the ones that are about to disappear). Used to find orphaned blobs. */
export function collectFileRefs(projects: readonly DemoProject[]): Set<string> {
  const ids = new Set<string>();
  for (const project of projects) {
    for (const item of project.items ?? []) {
      const id = fileRefToId(item.content);
      if (id) ids.add(id);
    }
    for (const envelope of project.envelopes) {
      for (const item of envelope.items ?? []) {
        const id = fileRefToId(item.content);
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

/* ── DB operations (client passed in for testability) ────────────────────── */

export interface UploadStartData {
  projectId: string;
  envelopeId: string | null;
  name: string;
  type: WorkspaceFileType;
  mime: string;
  totalBytes: number;
  createdBy: string;
}

/** Create an upload session and return its id plus chunking plan. */
export async function createUpload(
  client: Client,
  sectionKey: string,
  data: UploadStartData,
): Promise<{ uploadId: string; chunkSize: number; chunkCount: number }> {
  const uploadId = randomUUID();
  const chunkSize = UPLOAD_CHUNK_BYTES;
  const chunkCount = chunkCountFor(data.totalBytes, chunkSize);
  const createdAt = Date.now();

  /* Housekeeping only — a failure here (including a store hiccup) must never
     stop the caller from starting a real upload. The stale rows age out on a
     later attempt regardless. */
  try {
    await sweepStaleUploads(client);
  } catch (error) {
    console.error("[WORKSPACE] stale-upload sweep failed:", (error as Error).message);
  }

  await client.execute(
    `INSERT INTO WorkspaceUpload
       (id, sectionKey, projectId, envelopeId, name, type, mime,
        totalBytes, chunkSize, chunkCount, createdBy, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uploadId,
      sectionKey,
      data.projectId,
      data.envelopeId,
      data.name,
      data.type,
      data.mime,
      data.totalBytes,
      chunkSize,
      chunkCount,
      data.createdBy,
      createdAt,
    ],
  );
  return { uploadId, chunkSize, chunkCount };
}

/**
 * SQLite caps how many variables one statement may bind (999 on older builds).
 * Both sweeps below build an `IN (?, ?, …)` list from a query, so a large
 * backlog would otherwise fail with "too many SQL variables" and disable the
 * feature outright. Batched well under the cap instead.
 */
const DELETE_BATCH_SIZE = 500;

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Remove sessions (and their parts) older than the TTL. */
export async function sweepStaleUploads(client: Client): Promise<void> {
  const cutoff = Date.now() - UPLOAD_SESSION_TTL_MS;
  const res = await client.execute(
    "SELECT id FROM WorkspaceUpload WHERE createdAt < ?",
    [cutoff],
  );
  const ids = res.rows.map((r) => String(r.id));
  if (ids.length === 0) return;
  for (const batch of batches(ids, DELETE_BATCH_SIZE)) {
    const placeholders = batch.map(() => "?").join(", ");
    await client.batch(
      [
        {
          sql: `DELETE FROM WorkspaceUploadChunk WHERE uploadId IN (${placeholders})`,
          args: batch,
        },
        {
          sql: `DELETE FROM WorkspaceUpload WHERE id IN (${placeholders})`,
          args: batch,
        },
      ],
      "write",
    );
  }
}

/** Store one assembled part. Returns how many parts have arrived.
 *  When `expectedSectionKey` is given, the session must belong to that section
 *  — callers thread the caller's authorized section through so a chunk can
 *  never be written into (or assembled from) a session of another section. */
export async function saveChunk(
  client: Client,
  uploadId: string,
  chunkIndex: number,
  data: Uint8Array,
  expectedSectionKey?: string,
  expectedUserId?: string,
): Promise<{ received: number; chunkCount: number }> {
  const session = await client.execute(
    "SELECT sectionKey, totalBytes, chunkSize, chunkCount, createdBy FROM WorkspaceUpload WHERE id = ?",
    [uploadId],
  );
  const row = session.rows[0];
  if (!row) throw new Error("Upload session not found — please try again.");
  if (expectedSectionKey && String(row.sectionKey) !== expectedSectionKey) {
    throw new Error("Upload session belongs to a different section");
  }
  /* Section membership alone is not ownership: a teammate in the same section
     must not be able to append parts to, or complete, someone else's upload.
     Same owner check abortUpload already applies. */
  if (expectedUserId && String(row.createdBy) !== expectedUserId) {
    throw new Error("Not your upload");
  }
  const totalBytes = Number(row.totalBytes);
  const chunkSize = Number(row.chunkSize);
  const chunkCount = Number(row.chunkCount);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunkCount) {
    throw new Error("Invalid chunk index");
  }
  if (data.length > chunkSize) {
    throw new Error("Chunk is larger than allowed");
  }
  if (chunkIndex === chunkCount - 1) {
    const expectedFinal = totalBytes - (chunkCount - 1) * chunkSize;
    if (data.length !== expectedFinal) throw new Error("Unexpected final chunk size");
  } else if (data.length !== chunkSize) {
    throw new Error("Unexpected chunk size");
  }

  await client.execute(
    `INSERT INTO WorkspaceUploadChunk (uploadId, chunkIndex, data)
     VALUES (?, ?, ?)
     ON CONFLICT(uploadId, chunkIndex) DO UPDATE SET data = excluded.data`,
    [uploadId, chunkIndex, data],
  );

  const received = await client.execute(
    "SELECT COUNT(*) AS c FROM WorkspaceUploadChunk WHERE uploadId = ?",
    [uploadId],
  );
  return { received: Number(received.rows[0]?.c ?? 0), chunkCount };
}

/** Live bytes held in the shared store: stored file blobs plus the inline tree
 *  JSON (embedded data URIs live in the tree rows). Enforces MAX_WORKSPACE_BYTES. */
export async function workspaceUsedBytes(client: Client): Promise<number> {
  const [files, trees] = await Promise.all([
    client.execute("SELECT COALESCE(SUM(size), 0) AS s FROM WorkspaceFile"),
    client.execute("SELECT COALESCE(SUM(LENGTH(tree)), 0) AS s FROM DrawerSection"),
  ]);
  return Number(files.rows[0]?.s ?? 0) + Number(trees.rows[0]?.s ?? 0);
}

export interface CommittedFile {
  fileId: string;
  sectionKey: string;
  projectId: string;
  envelopeId: string | null;
  itemId: string;
  name: string;
  type: WorkspaceFileType;
  mime: string;
  size: number;
}

/** Assemble every part, persist the file and clean up the session. Atomic.
 *  When `expectedSectionKey` is given, the session must belong to that section
 *  (same cross-section guard as saveChunk). */
export async function commitUpload(
  client: Client,
  uploadId: string,
  itemId: string,
  expectedSectionKey?: string,
  expectedUserId?: string,
): Promise<CommittedFile> {
  const session = await client.execute(
    `SELECT sectionKey, projectId, envelopeId, name, type, mime, totalBytes, chunkCount, createdBy
     FROM WorkspaceUpload WHERE id = ?`,
    [uploadId],
  );
  const row = session.rows[0];
  if (!row) throw new Error("Upload session not found — please try again.");
  if (expectedSectionKey && String(row.sectionKey) !== expectedSectionKey) {
    throw new Error("Upload session belongs to a different section");
  }
  /* Owner-only, same as saveChunk and abortUpload: completing an upload links
     the assembled blob into a project, so it must be the session's own author. */
  if (expectedUserId && String(row.createdBy) !== expectedUserId) {
    throw new Error("Not your upload");
  }

  const chunkCount = Number(row.chunkCount);
  const totalBytes = Number(row.totalBytes);

  const chunks = await client.execute(
    "SELECT data FROM WorkspaceUploadChunk WHERE uploadId = ? ORDER BY chunkIndex ASC",
    [uploadId],
  );
  if (chunks.rows.length !== chunkCount) {
    throw new Error(
      `Incomplete upload (${chunks.rows.length} of ${chunkCount} parts received)`,
    );
  }

  const parts = chunks.rows.map((r) => Buffer.from(r.data as unknown as Uint8Array));
  const assembled = Buffer.concat(parts);
  if (assembled.length !== totalBytes) {
    throw new Error("Uploaded size does not match the declared size");
  }

  const fileId = randomUUID();
  const createdAt = Date.now();
  const committed: CommittedFile = {
    fileId,
    sectionKey: String(row.sectionKey),
    projectId: String(row.projectId),
    envelopeId: row.envelopeId == null ? null : String(row.envelopeId),
    itemId,
    name: String(row.name),
    type: isWorkspaceFileType(row.type) ? row.type : "FILE",
    mime: String(row.mime),
    size: assembled.length,
  };

  await client.batch(
    [
      {
        sql: `INSERT INTO WorkspaceFile
          (id, sectionKey, projectId, envelopeId, itemId, name, mime, size, data, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          committed.fileId,
          committed.sectionKey,
          committed.projectId,
          committed.envelopeId,
          committed.itemId,
          committed.name,
          committed.mime,
          committed.size,
          new Uint8Array(assembled),
          String(row.createdBy),
          createdAt,
        ],
      },
      { sql: "DELETE FROM WorkspaceUploadChunk WHERE uploadId = ?", args: [uploadId] },
      { sql: "DELETE FROM WorkspaceUpload WHERE id = ?", args: [uploadId] },
    ],
    "write",
  );

  return committed;
}

export interface WorkspaceFileRow {
  id: string;
  sectionKey: string;
  mime: string;
  size: number;
  data: Buffer;
}

/** Load a stored file's bytes. Returns null when the id doesn't exist. */
export async function getFile(
  client: Client,
  fileId: string,
): Promise<WorkspaceFileRow | null> {
  const res = await client.execute(
    "SELECT id, sectionKey, mime, size, data FROM WorkspaceFile WHERE id = ?",
    [fileId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    sectionKey: String(row.sectionKey),
    mime: String(row.mime),
    size: Number(row.size),
    data: Buffer.from(row.data as unknown as Uint8Array),
  };
}

/**
 * Cancel an in-progress upload for real: dropping its pending parts and the
 * session row. Owner-checked so one teammate can't wipe someone else's upload.
 */
export async function abortUpload(
  client: Client,
  uploadId: string,
  userId: string,
): Promise<void> {
  const res = await client.execute(
    "SELECT createdBy FROM WorkspaceUpload WHERE id = ?",
    [uploadId],
  );
  const row = res.rows[0];
  if (!row) throw new Error("Upload session not found");
  if (String(row.createdBy) !== userId) throw new Error("Not your upload");
  await client.batch(
    [
      { sql: "DELETE FROM WorkspaceUploadChunk WHERE uploadId = ?", args: [uploadId] },
      { sql: "DELETE FROM WorkspaceUpload WHERE id = ?", args: [uploadId] },
    ],
    "write",
  );
}

/**
 * True delete: purge stored file blobs in a section that no item references
 * anymore (items removed, projects/envelopes deleted, content overwritten).
 * This is the difference between "archive" and actually freeing the storage.
 * Returns how many files were deleted.
 */
export async function deleteOrphanedFiles(
  client: Client,
  sectionKey: string,
  referenced: ReadonlySet<string>,
): Promise<number> {
  const res = await client.execute(
    "SELECT id FROM WorkspaceFile WHERE sectionKey = ?",
    [sectionKey],
  );
  const orphaned = res.rows
    .map((r) => String(r.id))
    .filter((id) => !referenced.has(id));
  if (orphaned.length === 0) return 0;
  /* Batched for the same bound-variable reason as sweepStaleUploads: a section
     with many unreferenced blobs would otherwise exceed SQLite's variable cap
     and the purge would throw, leaving the storage unreclaimed. */
  for (const batch of batches(orphaned, DELETE_BATCH_SIZE)) {
    const placeholders = batch.map(() => "?").join(", ");
    await client.execute(
      `DELETE FROM WorkspaceFile WHERE id IN (${placeholders})`,
      batch,
    );
  }
  return orphaned.length;
}