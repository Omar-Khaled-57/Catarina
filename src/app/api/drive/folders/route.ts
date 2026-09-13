// POST /api/drive/folders — Create a drawer or envelope folder on Drive
// Body: { parentId: string, name: string }

import { NextResponse } from "next/server";
import { requireUser, jsonError, asString } from "@/lib/api-helpers";
import { getDriveConnection, createFolder } from "@/lib/drive";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parentId = asString(body.parentId, 200);
  const name = asString(body.name, 200);
  if (!parentId || !name) return jsonError("parentId and name are required", 400);

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  const id = await createFolder(conn, parentId, name);
  return NextResponse.json({ id, name });
}