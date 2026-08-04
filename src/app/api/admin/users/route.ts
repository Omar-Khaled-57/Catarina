// GET /api/admin/users — List all users (admin only)
// Returns users with their sections, pfp, bio, permissions

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { resolvePermissions } from "@/lib/permissions";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
    permissions: resolvePermissions(u.role, u.permissions),
  }));

  return NextResponse.json({ users: formatted });
}
