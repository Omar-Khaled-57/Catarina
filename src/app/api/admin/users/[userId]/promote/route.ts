// POST /api/admin/users/[userId]/promote — Toggle admin/member role

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const newRole = user.role === "ADMIN" ? "MEMBER" : "ADMIN";

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
