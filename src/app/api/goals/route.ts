// GET /api/goals — List goals with optional filtering by month and section
// POST /api/goals — Create a new goal (authenticated users, section-restricted)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  getUserContext,
  validateGoalFields,
  asString,
  parseDate,
  jsonError,
} from "@/lib/api-helpers";
import { notifySection, notifyMany } from "@/lib/notify";
import { ROLE_ADMIN } from "@/lib/constants";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const monthId = searchParams.get("monthId");
  const section = searchParams.get("section");
  const since = searchParams.get("since");

  const where: Record<string, unknown> = {};
  if (monthId) where.monthId = monthId;

  /* Non-admins can only read goals in their own sections */
  if (auth.data.role !== ROLE_ADMIN) {
    const ctx = await getUserContext(auth.data.userId);
    if (section && !ctx.sections.includes(section)) {
      return jsonError("Forbidden", 403);
    }
    if (ctx.sections.length === 0) {
      return jsonError("You are not assigned to any sections", 403);
    }
    where.section = section ? section : { in: ctx.sections };
  } else if (section) {
    where.section = section;
  }

  if (since) {
    const sinceDate = parseDate(since);
    if (!sinceDate) return jsonError("Invalid since", 400);
    where.updatedAt = { gt: sinceDate };
  }

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
  });

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

  /*
   * Deadline notification scheduling. This runs only on full loads (no
   * `since` filter) so delta polls don't re-run DB writes every 5s.
   * Dedup is enforced per-goal-per-day by the existing notification rows.
   */
  if (!since) {
    await maybeSendDeadlineNotifications(goals);
  }

  return NextResponse.json({ goals: formatted });
}

async function maybeSendDeadlineNotifications(
  goals: Array<{
    id: string;
    name: string;
    done: boolean;
    deadline: Date;
    assignments: { userId: string }[];
  }>
) {
  const now = new Date();
  for (const g of goals) {
    if (g.done) continue;

    const diffDays = Math.ceil(
      (g.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const assigneeIds = [...new Set(g.assignments.map((a) => a.userId))];
    if (assigneeIds.length === 0) continue;

    if (diffDays >= 0 && diffDays <= 5) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existing = await prisma.notification.findFirst({
        where: {
          type: "DEADLINE_APPROACHING",
          refId: g.id,
          createdAt: { gte: todayStart },
        },
      });
      if (!existing) {
        await notifyMany(assigneeIds, {
          type: "DEADLINE_APPROACHING",
          title: diffDays === 0 ? "Deadline is today!" : `Deadline in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
          message: `"${g.name}" is due ${diffDays === 0 ? "today" : `in ${diffDays} day${diffDays > 1 ? "s" : ""}`}.`,
          refId: g.id,
          refType: "goal",
        });
      }
    } else if (diffDays < 0) {
      const existingMissed = await prisma.notification.findFirst({
        where: { type: "DEADLINE_MISSED", refId: g.id },
      });
      if (!existingMissed) {
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

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body", 400);
    }

    const name = asString(body.name, 200);
    const section = asString(body.section, 50);
    const monthId = asString(body.monthId, 100);
    const deadline = parseDate(body.deadline);

    if (!name || !section || !monthId || !deadline) {
      return jsonError("Missing required fields", 400);
    }

    const fields = validateGoalFields(body as Record<string, unknown>);
    if (!fields.ok) return jsonError(fields.message, 400);

    /* The target month must actually exist */
    const monthExists = await prisma.month.findUnique({
      where: { id: monthId },
      select: { id: true },
    });
    if (!monthExists) return jsonError("Month not found", 400);

    /* Section restriction: members can only create goals in their assigned sections */
    if (auth.data.role !== ROLE_ADMIN) {
      const ctx = await getUserContext(auth.data.userId);
      if (!ctx.sections.includes(section)) {
        return jsonError("You can only create goals in your assigned sections", 403);
      }
      if (!ctx.permissions.canCreateGoals) {
        return jsonError("You don't have permission to create goals", 403);
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
        description: fields.data.description ?? "",
        goalNumber,
        current: fields.data.current ?? 0,
        target: fields.data.target ?? 1,
        deadline,
        section,
        monthId,
        authorId: auth.data.userId,
        deadlineSetByAdmin: auth.data.role === ROLE_ADMIN,
      },
      include: {
        comments: { select: { id: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, pfp: true } } },
        },
        steps: { orderBy: { order: "asc" } },
      },
    });

    /* Notify section members about the new goal */
    await notifySection(section, {
      type: "GOAL_CREATED",
      title: "New goal created",
      message: `${auth.data.email} created "${name}" in the ${section} section.`,
      refId: goal.id,
      refType: "goal",
    });

    return NextResponse.json(
      {
        goal: {
          ...goal,
          assignments: goal.assignments.map((a) => ({
            userId: a.userId,
            name: a.user.name,
            pfp: a.user.pfp,
            canCheck: a.canCheck,
            canEdit: a.canEdit,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[GOALS_POST]", error);
    return jsonError("Internal server error", 500);
  }
}
