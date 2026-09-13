// GET /api/drive/status — Is Drive configured, and is the current user connected?

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { isDriveEnabled, getDriveConnection } from "@/lib/drive";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const enabled = isDriveEnabled();
  const conn = enabled ? await getDriveConnection(auth.data.userId) : null;
  const root = await prisma.appConfig
    .findUnique({ where: { key: "drive.rootFolderId" } })
    .catch(() => null);

  return NextResponse.json({
    enabled,
    connected: !!conn,
    googleEmail: conn?.googleEmail ?? null,
    rootFolderId: root?.value ?? null,
  });
}