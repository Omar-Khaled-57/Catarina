// POST /api/auth/welcome-seen — Mark the welcome celebration as seen

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: payload.userId },
    data: { welcomeSeen: true },
  });

  return NextResponse.json({ ok: true });
}
