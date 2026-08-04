// GET /api/users?section=<section> — List users for the assignment picker
// Requires auth. The section param is mandatory; non-admins may only
// list users within sections they belong to (checked live against the DB).

import { NextResponse } from "next/server";
import { requireUser, getUserContext, jsonError } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  if (!section) {
    return jsonError("Missing required 'section' query param", 400);
  }

  /* Non-admins may only browse users in sections they belong to */
  if (auth.data.role !== ROLE_ADMIN) {
    const ctx = await getUserContext(auth.data.userId);
    if (!ctx.sections.includes(section)) {
      return jsonError("Forbidden", 403);
    }
  }

  const users = await prisma.user.findMany({
    where: {
      userSections: { some: { section } },
    },
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
