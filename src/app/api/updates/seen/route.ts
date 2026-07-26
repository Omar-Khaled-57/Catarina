// POST /api/updates/seen — Mark the current app version as seen by the user

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  /* Read current version from package.json */
  const pkg = await import("../../../../../package.json");
  const currentVersion: string = pkg.version;

  await prisma.user.update({
    where: { id: payload.userId },
    data: { lastSeenVersion: currentVersion },
  });

  return NextResponse.json({ ok: true });
}
