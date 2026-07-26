// GET /api/changes — Lightweight change detection endpoint
// Returns MAX timestamps + notification counts for delta-based polling
// ~3 row reads per call (indexed MAX + COUNT queries)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const monthId = searchParams.get("monthId");
  const section = searchParams.get("section");

  if (since && isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "Invalid 'since' parameter" }, { status: 400 });
  }

  const sinceDate = since ? new Date(since) : new Date(0);

  /* 1. MAX Goal.updatedAt — has any goal changed since `since`? */
  const goalWhere: Record<string, string> = {};
  if (monthId) goalWhere.monthId = monthId;
  if (section) goalWhere.section = section;

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
      userId: payload.userId,
      createdAt: { gt: sinceDate },
    },
  });

  return NextResponse.json({
    goalsUpdatedAt: goalAgg._max.updatedAt?.toISOString() || null,
    sectionsVersion: sectionAgg._max.updatedAt?.toISOString() || null,
    newNotifications,
  });
}
