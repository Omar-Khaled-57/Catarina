// POST /api/months/create — Create a new planning month
// Automatically carries over unfinished goals from the previous month

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const previousMonthId = typeof body?.previousMonthId === "string" ? body.previousMonthId : undefined;

    /* Determine the next month to create */
    let newYear: number;
    let newMonth: number;

    if (previousMonthId) {
      const prevMonth = await prisma.month.findUnique({
        where: { id: previousMonthId },
      }) as {
        id: string;
        name: string;
        year: number;
        month: number;
        isArchived: boolean;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      if (!prevMonth) {
        return NextResponse.json(
          { error: "Previous month not found" },
          { status: 404 }
        );
      }
      newMonth = prevMonth.month === 12 ? 1 : prevMonth.month + 1;
      newYear = prevMonth.month === 12 ? prevMonth.year + 1 : prevMonth.year;
    } else {
      const now = new Date();
      newMonth = now.getMonth() + 1;
      newYear = now.getFullYear();
    }

    /* Check if this month already exists */
    const existing = await prisma.month.findUnique({
      where: { year_month: { year: newYear, month: newMonth } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This month already exists" },
        { status: 409 }
      );
    }

    /* Create the new month and carry over unfinished goals inside one
     * transaction so a mid-way failure can't leave a half-built month. */
    const monthLabel = `${String(newMonth).padStart(2, "0")}/${String(newYear).slice(-2)}`;
    const carriedGoalNames: string[] = [];
    const carriedAssigneeIds: string[] = [];

    let newMonthRecord: { id: string; name: string; year: number; month: number; isArchived: boolean; createdAt: Date; updatedAt: Date };
    try {
      newMonthRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.month.create({
          data: {
            name: monthLabel,
            year: newYear,
            month: newMonth,
          },
        });

        if (previousMonthId) {
          const unfinishedGoals = await tx.goal.findMany({
            where: {
              monthId: previousMonthId,
              done: false,
            },
            include: {
              assignments: { select: { userId: true, canCheck: true, canEdit: true } },
            },
          });

          for (const goal of unfinishedGoals) {
            const copy = await tx.goal.create({
              data: {
                name: goal.name,
                description: goal.description,
                current: goal.current,
                target: goal.target,
                done: false,
                deadline: goal.deadline,
                carriedOver: true,
                section: goal.section,
                monthId: created.id,
                authorId: goal.authorId,
                deadlineSetByAdmin: true,
              },
            });

            /* Carry over the assignments too — a carried goal that loses its
             * assignees stops honoring their canCheck/canEdit capabilities. */
            if (goal.assignments.length > 0) {
              await tx.goalAssignment.createMany({
                data: goal.assignments.map((a) => ({
                  goalId: copy.id,
                  userId: a.userId,
                  canCheck: a.canCheck,
                  canEdit: a.canEdit,
                })),
              });
            }

            carriedGoalNames.push(goal.name);
            for (const a of goal.assignments) carriedAssigneeIds.push(a.userId);
          }
        }

        return created;
      });
    } catch (error) {
      /* The pre-check above can race against a concurrent same-year/month
       * create; map the unique violation to the same friendly 409. */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "This month already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    const carriedOver = carriedGoalNames.length;

    /* Notify all users about the new month */
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    });
    const allUserIds = allUsers.map((u) => u.id);

    if (allUserIds.length > 0) {
      await notifyMany(allUserIds, {
        type: "MONTH_CREATED",
        title: "New month created",
        message: `A new planning month has been created: ${newMonthRecord.name}.`,
        refId: newMonthRecord.id,
        refType: "month",
      });
    }

    /* Notify assignees about carried over goals */
    if (carriedOver > 0) {
      const carriedUserIds = [...new Set(carriedAssigneeIds)];
      if (carriedUserIds.length > 0) {
        await notifyMany(carriedUserIds, {
          type: "GOALS_CARRIED_OVER",
          title: "Goals carried over",
          message: `${carriedOver} goal${carriedOver > 1 ? "s" : ""} carried over to ${newMonthRecord.name}: ${carriedGoalNames.slice(0, 3).join(", ")}${carriedGoalNames.length > 3 ? "..." : ""}.`,
          refId: newMonthRecord.id,
          refType: "month",
        });
      }
    }

    return NextResponse.json(
      { month: newMonthRecord, carriedOver },
      { status: 201 }
    );
  } catch (error) {
    console.error("[MONTHS_CREATE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
