// PUT /api/auth/primary-section — Update the admin's highlighted section
// Only admins can set this; members use all their sections for highlighting

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { SECTIONS } from "@/lib/auth";

export async function PUT(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { section } = await req.json();

  if (!section || !SECTIONS.includes(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: payload.userId },
    data: { primarySection: section },
  });

  return NextResponse.json({ primarySection: section });
}
