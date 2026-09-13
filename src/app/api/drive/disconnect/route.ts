// POST /api/drive/disconnect — Remove the current user's Google Drive connection

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { clearDriveConnection } from "@/lib/drive";

export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  await clearDriveConnection(auth.data.userId);
  return NextResponse.json({ success: true });
}