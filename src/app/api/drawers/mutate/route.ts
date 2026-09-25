// POST /api/drawers/mutate — Apply one drawer-tree mutation to the shared
// workspace and return the refreshed section.
//
// Body shape: { action, sectionKey, ...payload }
//   createProject/renameProject/deleteProject        (projectId)
//   addEnvelope/renameEnvelope/deleteEnvelope        (projectId, envelopeId?)
//   createItem                                       (projectId, envelopeId?)
//   renameItem/updateItemContent/removeItem          (projectId, envelopeId?, itemId)
//   groupItems                                       (projectId, itemIds[])
//
// Upload actions (large files arrive in ≤3MB parts, Vercel caps bodies at
// ~4.5MB). The pieces are stored raw as they arrive and assembled on the last
// one; the tree keeps only a `file://<id>` reference so the workspace JSON
// stays small. See src/lib/workspaceFiles.ts.
//   uploadStart     { projectId, envelopeId?, item: { name, type, mime, size } }
//   uploadChunk     { uploadId, index, data }   (data = base64 of one part)
//   uploadComplete  { uploadId }
//   uploadAbort     { uploadId }                (cancel: drop parts + session)
//
// Deleting is REAL: any stored file blob that no item references anymore is
// purged after every mutation (see purgeOrphans), so removing a file, envelope
// or project actually frees the storage instead of just archiving it.
//
// All ids are generated/validated server-side; the client only sends names.

import { NextRequest, NextResponse } from "next/server";
import { requireUserContext, jsonError } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rateLimit";
import { ROLE_ADMIN } from "@/lib/constants";
import {
  DrawerConflictError,
  getSectionDef,
  insertItemIntoSection,
  mutateSection,
} from "@/lib/drawers";
import type { DemoProject } from "@/components/tools/drawers/types";
import {
  abortUpload,
  collectFileRefs,
  commitUpload,
  createUpload,
  deleteOrphanedFiles,
  getUploadStore,
  isWorkspaceFileType,
  MAX_UPLOAD_BYTES,
  saveChunk,
  UPLOAD_CHUNK_BYTES,
  FILE_REF_PREFIX,
  MAX_WORKSPACE_BYTES,
  workspaceUsedBytes,
} from "@/lib/workspaceFiles";

/** Cap for inline base64 content on regular createItem/updateItemContent.
 *  Anything larger must come through the chunked path (uploadStart etc.).
 *  Kept under Vercel's ~4.5MB request-body cap (leaving room for the JSON
 *  envelope) so this handler's own friendly 413 can fire before the platform
 *  rejects the request outright. */
const MAX_INLINE_CONTENT_LENGTH = 4_380_000;

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asUploadId(value: unknown): string {
  const id = asTrimmed(value);
  return id.length > 0 && id.length <= 100 ? id : "";
}

/** Oversized inline content → error message; null when acceptable. */
function oversizedInlineContent(body: Record<string, unknown>): string | null {
  if (body.action === "createItem") {
    const item = body.item as { content?: unknown } | undefined;
    if (typeof item?.content === "string" && item.content.length > MAX_INLINE_CONTENT_LENGTH) {
      return "That file is too large to upload in one piece — it will be split into parts automatically.";
    }
  }
  if (body.action === "updateItemContent") {
    if (typeof body.content === "string" && body.content.length > MAX_INLINE_CONTENT_LENGTH) {
      return "That content is too large to save in one piece.";
    }
  }
  return null;
}

/** Actions that can leave stored blobs unreferenced and should trigger the
 *  orphan purge. Pure additions/renames never orphan anything, so running the
 *  purge on them only wasted a DB scan on every drawer add/delete. */
const DESTRUCTIVE_ACTIONS = new Set([
  "deleteProject",
  "deleteEnvelope",
  "removeItem",
  "updateItemContent",
]);

export async function POST(request: NextRequest) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  /* Drawer mutations write to the shared Turso store (chunked uploads can fill
     it), so here too the app's shared-window limiter applies — keyed per user,
     never tripped by a serial client queue, and fail-closed like every other
     route: a Turso error degrades to the in-memory backstop rather than
     allowing the request. */
  const rateLimit = await checkRateLimit(`drawer-mutate:${auth.data.id}`, 240, 60_000);
  if (rateLimit.limited) {
    return jsonError("Too many drawer actions — please slow down.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const sectionKey = typeof body.sectionKey === "string" ? body.sectionKey : "";
  if (!action || !sectionKey) {
    return jsonError("action and sectionKey are required", 400);
  }

  const def = await getSectionDef(sectionKey);
  if (!def) return jsonError("Unknown section", 404);

  /* Drawers are a shared workspace per section — a user may only touch the
     sections the dashboard lets them into. */
  if (
    auth.data.role !== ROLE_ADMIN &&
    !auth.data.sections.includes(def.key.toUpperCase())
  ) {
    return jsonError("Forbidden", 403);
  }

  try {
    if (action === "uploadStart") return await handleUploadStart(def.key, body, auth.data.id);
    if (action === "uploadChunk") return await handleUploadChunk(def.key, body);
    if (action === "uploadComplete") return await handleUploadComplete(def, body);
    if (action === "uploadAbort")
      return await handleUploadAbort(body, auth.data.id);

    const inlineBlock = oversizedInlineContent(body);
    if (inlineBlock) return jsonError(inlineBlock, 413);

    const section = await mutateSection(def, action, body);
    /* Deleting an item/project/envelope (or overwriting a file ref) leaves
       stored blobs with no owner — purge them so deletion is real, not an
       archive. Only destructive actions can orphan, and never fail the
       mutation itself. */
    if (DESTRUCTIVE_ACTIONS.has(action)) {
      await purgeOrphans(def.key, section.projects);
    }
    return NextResponse.json({ section });
  } catch (error) {
    if (error instanceof DrawerConflictError) {
      return jsonError(error.message, 409);
    }
    return jsonError(
      error instanceof Error ? error.message : "Invalid drawer mutation",
      400,
    );
  }
}

/** Delete stored files in a section that nothing references anymore. */
async function purgeOrphans(
  sectionKey: string,
  projects: DemoProject[],
) {
  const client = getUploadStore();
  if (!client) return;
  try {
    await deleteOrphanedFiles(client, sectionKey, collectFileRefs(projects));
  } catch {
    // Non-fatal: the mutation already succeeded; orphans wait for the next one.
  }
}

/** Begin a multi-part upload: create the session, return the chunking plan. */
async function handleUploadStart(
  sectionKey: string,
  body: Record<string, unknown>,
  userId: string,
) {
  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const projectId = asTrimmed(body.projectId);
  const envelopeId = asTrimmed(body.envelopeId) || null;
  const item = body.item as Record<string, unknown> | undefined;

  const name = asTrimmed(item?.name).slice(0, 500);
  const type = isWorkspaceFileType(item?.type) ? item.type : "FILE";
  const mime =
    typeof item?.mime === "string"
      ? item.mime.slice(0, 200)
      : "application/octet-stream";
  const totalBytes =
    typeof item?.size === "number" && Number.isInteger(item.size) && item.size > 0
      ? item.size
      : null;

  if (!projectId) return jsonError("projectId is required", 400);
  if (!name) return jsonError("File name is required", 400);
  if (totalBytes === null) return jsonError("Invalid file size", 400);
  if (totalBytes > MAX_UPLOAD_BYTES) {
    return jsonError(`That file is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`, 413);
  }

  /* Ceiling over the whole shared store: refuse before any byte is put in if
     the section-level accounting says there's no room. A concurrent upload can
     overshoot by at most one declared size — acceptable, still bounds the DB. */
  const used = await workspaceUsedBytes(client);
  if (used + totalBytes > MAX_WORKSPACE_BYTES) {
    return jsonError(
      "The shared workspace is full — delete some drawer files before uploading more.",
      413,
    );
  }

  const plan = await createUpload(client, sectionKey, {
    projectId,
    envelopeId,
    name,
    type,
    mime,
    totalBytes,
    createdBy: userId,
  });
  return NextResponse.json(plan);
}

/** Store one arrived part. */
async function handleUploadChunk(sectionKey: string, body: Record<string, unknown>) {
  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const uploadId = asUploadId(body.uploadId);
  const index =
    typeof body.index === "number" && Number.isInteger(body.index) ? body.index : null;
  const b64 = typeof body.data === "string" ? body.data : "";
  if (!uploadId || index === null || !b64) {
    return jsonError("uploadId, index and data are required", 400);
  }
  /* Guard before decoding: a chunk's base64 is at most 4/3 × raw bytes plus
     padding. saveChunk enforces the exact per-part size on the decoded bytes. */
  if (b64.length > Math.ceil((UPLOAD_CHUNK_BYTES * 4) / 3) + 4) {
    return jsonError("Chunk payload is too large", 413);
  }

  const data = Buffer.from(b64, "base64");
  if (data.length === 0) return jsonError("Empty chunk", 400);

  const result = await saveChunk(client, uploadId, index, data, sectionKey);
  return NextResponse.json(result);
}

/** Cancel an in-progress upload and drop its stored parts. */
async function handleUploadAbort(
  body: Record<string, unknown>,
  userId: string,
) {
  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const uploadId = asUploadId(body.uploadId);
  if (!uploadId) return jsonError("uploadId is required", 400);
  await abortUpload(client, uploadId, userId);
  return NextResponse.json({ aborted: true });
}

/** Finish an upload: assemble the parts into a stored file, then add the tree
 *  item that references it — the workspace JSON only carries `file://<id>`. */
async function handleUploadComplete(
  def: NonNullable<Awaited<ReturnType<typeof getSectionDef>>>,
  body: Record<string, unknown>,
) {
  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const uploadId = asUploadId(body.uploadId);
  if (!uploadId) return jsonError("uploadId is required", 400);

  const itemId = crypto.randomUUID();
  const committed = await commitUpload(client, uploadId, itemId, def.key);

  const section = await insertItemIntoSection(
    def,
    committed.projectId,
    committed.envelopeId,
    itemId,
    {
      name: committed.name,
      type: committed.type,
      content: `${FILE_REF_PREFIX}${committed.fileId}`,
    },
  );
  await purgeOrphans(def.key, section.projects);
  return NextResponse.json({ section });
}