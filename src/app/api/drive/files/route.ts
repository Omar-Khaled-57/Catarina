// POST /api/drive/files — Upload a raw file (image/video/binary) into Drive
// Multipart form fields: parentId, name (optional), file (the actual File)

import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { getDriveConnection, uploadItem } from "@/lib/drive";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB — generous for images/videos

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }

  const parentId = String(form.get("parentId") ?? "").trim();
  const file = form.get("file");
  if (!parentId) return jsonError("parentId is required", 400);
  if (!(file instanceof File)) return jsonError("file is required", 400);
  if (file.size <= 0) return jsonError("file is empty", 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("File is too large (max 25 MB)", 400);
  }

  const name = String(form.get("name") ?? "").trim() || file.name;

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const item = await uploadItem(conn, parentId, name, file.type || "application/octet-stream", bytes);
  return NextResponse.json({ item });
}