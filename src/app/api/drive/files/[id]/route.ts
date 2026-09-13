// PATCH /api/drive/files/[id] — Rename and/or update item content
// Body: { name?, content?, link? }
// DELETE /api/drive/files/[id] — Move the file to trash (recoverable)

import { NextResponse } from "next/server";
import { requireUser, jsonError, asString } from "@/lib/api-helpers";
import { getDriveConnection, updateItem, trashFile } from "@/lib/drive";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = body.name === undefined ? undefined : asString(body.name, 200);
  const content =
    body.content === undefined
      ? undefined
      : typeof body.content === "string"
        ? body.content.slice(0, 500_000)
        : undefined;
  const link =
    body.link === undefined ? undefined : asString(body.link, 2000);
  if (
    name === undefined &&
    content === undefined &&
    link === undefined
  ) {
    return jsonError("Nothing to update", 400);
  }

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  await updateItem(conn, id, {
    ...(name ? { name } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(link ? { link } : {}),
  });
  return NextResponse.json({ success: true, id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  await trashFile(conn, id);
  return NextResponse.json({ success: true });
}