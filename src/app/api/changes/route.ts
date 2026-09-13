// GET /api/changes — Lightweight change detection endpoint
// Returns MAX timestamps + notification counts for delta-based polling
// ~3 row reads per call (indexed MAX + COUNT queries)

import { NextResponse } from "next/server";
import { requireUser, getUserContext, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN } from "@/lib/constants";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const monthId = searchParams.get("monthId");
  const section = searchParams.get("section");

  if (since && isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "Invalid 'since' parameter" }, { status: 400 });
  }

  const sinceDate = since ? new Date(since) : new Date(0);

  /* Non-admins may only poll change timestamps for their own sections, so the
   * endpoint can't be used to probe activity in other sections. */
  const ctx = await getUserContext(auth.data.userId);

  /* 1. MAX Goal.updatedAt — has any goal changed since `since`? */
  const goalWhere: Record<string, string | { in: string[] }> = {};
  if (ctx.role !== ROLE_ADMIN) {
    if (section && !ctx.sections.includes(section)) {
      return jsonError("Forbidden", 403);
    }
    goalWhere.section = section ?? { in: ctx.sections };
  } else if (section) {
    goalWhere.section = section;
  }
  if (monthId) goalWhere.monthId = monthId;

  const goalAgg = await prisma.goal.aggregate({
    where: goalWhere,
    _max: { updatedAt: true },
  });

  /* 2. MAX SectionConfig.updatedAt — have sections changed? */
  const sectionAgg = await prisma.sectionConfig.aggregate({
    _max: { updatedAt: true },
  });

  /* 3. COUNT new notifications for user since `since` */
  const newNotifications = await prisma.notification.count({
    where: {
      userId: auth.data.userId,
      createdAt: { gt: sinceDate },
    },
  });

  return NextResponse.json({
    goalsUpdatedAt: goalAgg._max.updatedAt?.toISOString() || null,
    sectionsVersion: sectionAgg._max.updatedAt?.toISOString() || null,
    newNotifications,
  });
}
