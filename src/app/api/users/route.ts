// GET /api/users — List users for assignment picker
// Returns users who belong to the specified section

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  const where: Record<string, unknown> = {};
  if (section) {
    where.userSections = { some: { section } };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      pfp: true,
      userSections: { select: { section: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      pfp: u.pfp,
      sections: u.userSections.map((us) => us.section),
    })),
  });
}
