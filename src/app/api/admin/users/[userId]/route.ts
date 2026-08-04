// PUT /api/admin/users/[userId] — Update a user (admin only)
// Can update name, email, bio, pfp, role, permissions, password
// DELETE /api/admin/users/[userId] — Delete a user (admin only)

import { NextResponse } from "next/server";
import {
  requireAdmin,
  asString,
  jsonError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  serializePermissions,
  type MemberPermissions,
} from "@/lib/permissions";
import { PERMISSION_KEYS } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { ROLE_ADMIN, ROLE_MEMBER } from "@/lib/constants";
import bcrypt from "bcryptjs";

interface Params {
  params: Promise<{ userId: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const data: Record<string, string | null | boolean> = {};

  if (body.name !== undefined) {
    const name = asString(body.name, 100);
    if (!name) return jsonError("Invalid name", 400);
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = asString(body.email, 200);
    if (!email || !EMAIL_RE.test(email)) return jsonError("Valid email is required", 400);
    data.email = email.toLowerCase();
  }

  if (body.bio !== undefined) {
    const bio = asString(body.bio, 2000);
    if (bio === null) return jsonError("Invalid bio", 400);
    data.bio = bio;
  }

  if (body.pfp !== undefined) {
    if (body.pfp === "") {
      data.pfp = null;
    } else {
      const pfp = asString(body.pfp, 2_000_000);
      if (pfp === null) return jsonError("Invalid profile picture", 400);
      data.pfp = pfp;
    }
  }

  if (body.role !== undefined) {
    if (body.role !== ROLE_ADMIN && body.role !== ROLE_MEMBER) {
      return jsonError("Invalid role", 400);
    }
    /* Prevent an admin from demoting themselves or removing the last admin */
    if (body.role === ROLE_MEMBER && userId === auth.data.userId) {
      return jsonError("You cannot demote your own account", 400);
    }
    data.role = body.role;
  }

  if (body.permissions !== undefined && typeof body.permissions === "object") {
    const perms: MemberPermissions = {
      canCreateGoals: false,
      canEditGoals: false,
      canDeleteGoals: false,
      canManageMembers: false,
      canCreateMonths: false,
    };
    for (const key of PERMISSION_KEYS) {
      const value = (body.permissions as Record<string, unknown>)[key];
      if (typeof value === "boolean") perms[key] = value;
    }
    data.permissions = serializePermissions(perms);
  }

  if (body.newPassword !== undefined) {
    const newPassword = asString(body.newPassword, 200);
    if (!newPassword || newPassword.length < 6) {
      return jsonError("Password must be at least 6 characters", 400);
    }
    data.password = await bcrypt.hash(newPassword, 12);
  }

  /* Validate email uniqueness when changing */
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email as string, NOT: { id: userId } },
      select: { id: true },
    });
    if (existing) return jsonError("Email already in use", 409);
  }

  /* Prevent removing the last admin when demoting another admin */
  if (data.role === ROLE_MEMBER && userId !== auth.data.userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role === ROLE_ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: ROLE_ADMIN } });
      if (adminCount <= 1) {
        return jsonError("Cannot demote the last admin", 400);
      }
    }
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
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return jsonError("User not found", 404);
    }
    console.error("[ADMIN_USER_UPDATE]", error);
    return jsonError("Failed to update user", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = await params;

  if (userId === auth.data.userId) {
    return jsonError("Cannot delete your own account", 400);
  }

  /* Get user info before deletion for notification */
  const userToDelete = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, _count: { select: { goals: true } } },
  });
  if (!userToDelete) return jsonError("User not found", 404);

  /* Never allow deleting the last admin */
  if (userToDelete.role === ROLE_ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: ROLE_ADMIN } });
    if (adminCount <= 1) {
      return jsonError("Cannot delete the last admin", 400);
    }
  }

  /* Deleting a member cascades to every goal they authored — block instead of silently wiping data */
  if (userToDelete._count.goals > 0) {
    return jsonError(
      `Cannot delete ${userToDelete.name}: they authored ${userToDelete._count.goals} goal${userToDelete._count.goals > 1 ? "s" : ""}. Reassign or remove those goals first.`,
      400
    );
  }

  await prisma.user.delete({ where: { id: userId } });

  /* Notify all admins about the deletion */
  const admins = await prisma.user.findMany({
    where: { role: ROLE_ADMIN },
    select: { id: true },
  });
  for (const admin of admins) {
    if (admin.id !== auth.data.userId) {
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

  return NextResponse.json({ success: true });
}
