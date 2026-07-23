// GET /api/auth/me — Return the currently authenticated user
// Returns 401 if no valid token is present

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";

export async function GET() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  /* Fetch fresh user data with sections */
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      pfp: true,
      bio: true,
      primarySection: true,
      permissions: true,
      userSections: { select: { section: true } },
    },
  }) as {
    id: string;
    name: string;
    email: string;
    role: string;
    pfp: string | null;
    bio: string | null;
    primarySection: string | null;
    permissions: string;
    userSections: { section: string }[];
  } | null;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  /* Ensure every user has the hardcoded welcome notification */
  const hasWelcome = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      title: "Why Catarina? 🌸",
    },
  });

  if (!hasWelcome) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "Why Catarina? 🌸",
        message:
          "هو كده يكتفمك",
        pinned: true,
        refType: "audio",
        refId: "/fun.mp3",
      },
    });
  }

  return NextResponse.json({
    user: {
      ...user,
      sections: user.userSections.map((us) => us.section),
      userSections: undefined,
      permissions: user.role === "ADMIN" ? { canCreateGoals: true, canEditGoals: true, canDeleteGoals: true, canManageMembers: true, canCreateMonths: true } : parsePermissions(user.permissions),
    },
  });
}
