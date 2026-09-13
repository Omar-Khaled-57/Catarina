// PATCH /api/drive/folders/[id] — Rename a folder
// DELETE /api/drive/folders/[id] — Move a folder (and its children) to trash

import { NextResponse } from "next/server";
import { requireUser, jsonError, asString } from "@/lib/api-helpers";
import { getDriveConnection, renameFile, trashFile } from "@/lib/drive";

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

  const name = asString(body.name, 200);
  if (!name) return jsonError("name is required", 400);

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  await renameFile(conn, id, name);
  return NextResponse.json({ success: true, id, name });
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