// POST /api/admin/users/[userId]/promote — Toggle admin/member role (admin only)

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { ROLE_ADMIN, ROLE_MEMBER } from "@/lib/constants";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) return jsonError("User not found", 404);

  const newRole = user.role === ROLE_ADMIN ? ROLE_MEMBER : ROLE_ADMIN;

  /* Prevent an admin from demoting themselves or removing the last admin */
  if (newRole === ROLE_MEMBER) {
    if (userId === auth.data.userId) {
      return jsonError("You cannot demote your own account", 400);
    }
    const adminCount = await prisma.user.count({ where: { role: ROLE_ADMIN } });
    if (adminCount <= 1) {
      return jsonError("Cannot demote the last admin", 400);
    }
  }

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
