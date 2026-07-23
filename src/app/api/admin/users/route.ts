// GET /api/admin/users — List all users (admin only)
// Returns users with their sections, pfp, bio, permissions

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";

export async function GET() {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      pfp: true,
      bio: true,
      permissions: true,
      createdAt: true,
      userSections: { select: { section: true } },
      _count: { select: { goals: true, comments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const formatted = users.map((u) => ({
    ...u,
    sections: u.userSections.map((us) => us.section),
    userSections: undefined,
    permissions: u.role === "ADMIN" ? { canCreateGoals: true, canEditGoals: true, canDeleteGoals: true, canManageMembers: true, canCreateMonths: true } : parsePermissions(u.permissions),
  }));

  return NextResponse.json({ users: formatted });
}
