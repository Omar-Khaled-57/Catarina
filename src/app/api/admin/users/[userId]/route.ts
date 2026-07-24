// PUT /api/admin/users/[userId] — Update a user (admin only)
// Can update name, email, bio, pfp, role, permissions

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { serializePermissions, type MemberPermissions } from "@/lib/permissions";
import { notify } from "@/lib/notify";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();
  const { name, email, bio, pfp, role, permissions } = body;

  const data: Record<string, string | null> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (bio !== undefined) data.bio = bio || null;
  if (pfp !== undefined) data.pfp = pfp || null;
  if (role !== undefined && ["ADMIN", "MEMBER"].includes(role)) data.role = role;
  if (permissions !== undefined && typeof permissions === "object") {
    data.permissions = serializePermissions(permissions as MemberPermissions);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pfp: true,
        bio: true,
        permissions: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[ADMIN_USER_UPDATE]", error);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}

// DELETE /api/admin/users/[userId] — Delete a user (admin only)
export async function DELETE(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === payload.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    /* Get user info before deletion for notification */
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, userSections: { select: { section: true } } },
    }) as { name: string; userSections: { section: string }[] } | null;

    await prisma.user.delete({ where: { id: userId } });

    /* Notify all admins about the deletion */
    if (userToDelete) {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      }) as Array<{ id: string }>;
      for (const admin of admins) {
        if (admin.id !== payload.userId) {
          await notify({
            userId: admin.id,
            type: "MEMBER_DELETED",
            title: "Member deleted",
            message: `${userToDelete.name} has been deleted from the system by an admin.`,
            refId: userId,
            refType: "user",
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_USER_DELETE]", error);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
