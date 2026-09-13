// POST /api/drive/files/json — Create a text/link/code item on Drive
// Body: { parentId, name, type, content?, link? }

import { NextResponse } from "next/server";
import { requireUser, jsonError, asString } from "@/lib/api-helpers";
import { getDriveConnection, createItem } from "@/lib/drive";
import type { DirItem } from "@/components/tools/drawers/types";

const TYPES: DirItem["type"][] = ["CODE", "IMAGE", "FILE", "LINK", "NOTE", "VIDEO"];

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
  const type = typeof body.type === "string" ? body.type : "";
  if (!parentId || !name || !TYPES.includes(type as DirItem["type"])) {
    return jsonError("parentId, name and a valid type are required", 400);
  }
  const content = asString(body.content, 500_000);
  const link = asString(body.link, 2000);

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  const item = await createItem(conn, {
    parentId,
    name,
    type: type as DirItem["type"],
    ...(content ? { content } : {}),
    ...(link ? { link } : {}),
  });
  return NextResponse.json({ item });
}