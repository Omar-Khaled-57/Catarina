// POST /api/drive/files/[id]/move — Move a file into another folder
// Body: { parentId: string, oldParentId: string }

import { NextResponse } from "next/server";
import { requireUser, jsonError, asString } from "@/lib/api-helpers";
import { getDriveConnection, moveItem } from "@/lib/drive";

export async function POST(
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

  const parentId = asString(body.parentId, 200);
  const oldParentId = asString(body.oldParentId, 200);
  if (!parentId || !oldParentId) return jsonError("parentId and oldParentId are required", 400);

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  await moveItem(conn, id, parentId, oldParentId);
  return NextResponse.json({ success: true });
}