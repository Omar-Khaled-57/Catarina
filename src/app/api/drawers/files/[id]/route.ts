// GET /api/drawers/files/[id] — stream one assembled workspace file as raw
// bytes so the client can build an object URL (preview/download). Only
// authenticated users can read; large blobs are served as a streamed body so
// they don't count against the 4.5MB response cap of JSON payloads.

import { NextRequest } from "next/server";
import { requireUser, canAccessSection, jsonError } from "@/lib/api-helpers";
import { getFile, getUploadStore, normalizeFileId } from "@/lib/workspaceFiles";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const normalized = normalizeFileId(id);
  if (!normalized) return jsonError("Invalid file id", 400);

  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const file = await getFile(client, normalized);
  if (!file) return jsonError("File not found", 404);

  /* Non-members are not told the file exists — return 404 instead of 403
     so the response is the same as a missing id. */
  if (!(await canAccessSection(auth.data.userId, file.sectionKey))) {
    return jsonError("File not found", 404);
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}