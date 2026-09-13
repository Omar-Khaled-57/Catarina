// GET /api/drive/files/[id]/content — Stream a file's bytes from Drive.
// Used as the src for image/video previews and for text content fetching.

import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { getDriveConnection, streamItem } from "@/lib/drive";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  const result = await streamItem(conn, id);
  if (!result) return jsonError("File not found", 404);
  if ("type" in result) return jsonError("This file has no readable content", 415);

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": "inline",
    },
  });
}