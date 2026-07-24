// POST /api/admin/users/[userId]/promote — Toggle admin/member role

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId } }) as {
    id: string;
    name: string;
    email: string;
    role: string;
    password: string;
    pfp: string | null;
    bio: string | null;
    primarySection: string | null;
    permissions: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const newRole = user.role === "ADMIN" ? "MEMBER" : "ADMIN";

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, name: true, role: true },
  });

  /* Notify the affected user about their role change */
  await notify({
    userId,
    type: "ROLE_CHANGED",
    title: `Role changed to ${newRole}`,
    message: `Your role has been changed from ${user.role} to ${newRole} by an admin.`,
    refId: userId,
    refType: "user",
  });

  return NextResponse.json({ user: updated });
}
