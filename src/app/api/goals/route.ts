// GET /api/goals — List goals with optional filtering by month and section
// POST /api/goals — Create a new goal (authenticated users, section-restricted)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";
import { notifySection, notifyMany } from "@/lib/notify";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monthId = searchParams.get("monthId");
  const section = searchParams.get("section");
  const since = searchParams.get("since");

  /* Build filter object */
  const where: Record<string, unknown> = {};
  if (monthId) where.monthId = monthId;
  if (section) where.section = section;
  if (since) where.updatedAt = { gt: new Date(since) };

  const goals = await prisma.goal.findMany({
    where,
    include: {
      comments: { select: { id: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, pfp: true } } },
      },
      steps: { orderBy: { order: "asc" } },
    },
    orderBy: [{ done: "asc" }, { deadline: "asc" }],
  }) as unknown as Array<{
    id: string;
    name: string;
    description: string;
    current: number;
    target: number;
    done: boolean;
    deadline: Date;
    carriedOver: boolean;
    section: string;
    monthId: string;
    authorId: string;
    goalNumber: number;
    completedAt: Date | null;
    deadlineSetByAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
    comments: { id: string }[];
    assignments: {
      userId: string;
      canCheck: boolean;
      canEdit: boolean;
      user: { id: string; name: string; pfp: string | null };
    }[];
    steps: { id: string; text: string; done: boolean; order: number; goalId: string; createdAt: Date; updatedAt: Date }[];
  }>;

  /* Flatten assignment user data */
  const formatted = goals.map((g) => ({
    ...g,
    assignments: g.assignments.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      pfp: a.user.pfp,
      canCheck: a.canCheck,
      canEdit: a.canEdit,
    })),
  }));

  /* Check for approaching deadlines and create notifications (once per goal per day) */
  const now = new Date();
  for (const g of goals) {
    if (g.done) continue;
    const dl = new Date(g.deadline);
    const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 5 && diffDays >= 0) {
      /* Check if we already notified about this goal today */
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existing = await prisma.notification.findFirst({
        where: {
          type: "DEADLINE_APPROACHING",
          refId: g.id,
          createdAt: { gte: todayStart },
        },
      });
      if (!existing) {
        const assigneeIds = g.assignments.map((a) => a.userId);
        if (assigneeIds.length > 0) {
          await notifyMany(assigneeIds, {
            type: "DEADLINE_APPROACHING",
            title: diffDays === 0 ? "Deadline is today!" : `Deadline in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
            message: `"${g.name}" is due ${diffDays === 0 ? "today" : `in ${diffDays} day${diffDays > 1 ? "s" : ""}`}.`,
            refId: g.id,
            refType: "goal",
          });
        }
      }
    }

    if (diffDays < 0) {
      /* Deadline missed — notify once */
      const existingMissed = await prisma.notification.findFirst({
        where: {
          type: "DEADLINE_MISSED",
          refId: g.id,
        },
      });
      if (!existingMissed) {
        const assigneeIds = g.assignments.map((a) => a.userId);
        if (assigneeIds.length > 0) {
          await notifyMany(assigneeIds, {
            type: "DEADLINE_MISSED",
            title: "Deadline missed",
            message: `"${g.name}" was due ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""} ago.`,
            refId: g.id,
            refType: "goal",
          });
        }
      }
    }
  }

  return NextResponse.json({ goals: formatted });
}

export async function POST(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, current, target, deadline, section, monthId } =
      await req.json();

    if (!name || !deadline || !section || !monthId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    /* Section restriction: members can only create goals in their assigned sections */
    if (payload.role !== "ADMIN") {
      const userWithSections = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { userSections: { select: { section: true } } },
      }) as {
        userSections: { section: string }[];
      } | null;
      const userSections = userWithSections?.userSections.map((us: { section: string }) => us.section) || [];
      const perms = parsePermissions(
        (await prisma.user.findUnique({ where: { id: payload.userId }, select: { permissions: true } }))?.permissions || "{}"
      );

      if (!userSections.includes(section)) {
        return NextResponse.json(
          { error: "You can only create goals in your assigned sections" },
          { status: 403 }
        );
      }
      if (!perms.canCreateGoals) {
        return NextResponse.json(
          { error: "You don't have permission to create goals" },
          { status: 403 }
        );
      }
    }

    const lastGoal = await prisma.goal.findFirst({
      where: { section },
      orderBy: { goalNumber: "desc" },
      select: { goalNumber: true },
    });
    const goalNumber = (lastGoal?.goalNumber || 0) + 1;

    const goal = await prisma.goal.create({
      data: {
        name,
        description: description || "",
        goalNumber,
        current: current || 0,
        target: target || 1,
        deadline: new Date(deadline),
        section,
        monthId,
        authorId: payload.userId,
        deadlineSetByAdmin: payload.role === "ADMIN",
      },
    });

    /* Notify section members and admins about the new goal */
    const author = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { name: true },
    });

    await notifySection(section, {
      type: "GOAL_CREATED",
      title: "New goal created",
      message: `${author?.name || "Someone"} created "${name}" in the ${section} section.`,
      refId: goal.id,
      refType: "goal",
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error("[GOALS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
