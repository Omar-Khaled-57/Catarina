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
    }) as {
      id: string;
      name: string;
      year: number;
      month: number;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    if (existing) {
      return NextResponse.json(
        { error: "This month already exists" },
        { status: 409 }
      );
    }

    /* Create the new month */
    const monthLabel = `${String(newMonth).padStart(2, "0")}/${String(newYear).slice(-2)}`;
    const newMonthRecord = await prisma.month.create({
      data: {
        name: monthLabel,
        year: newYear,
        month: newMonth,
      },
    });

    /* Carry over unfinished goals from the previous month */
    let carriedOver = 0;
    let carriedGoalNames: string[] = [];
    if (previousMonthId) {
      const unfinishedGoals = await prisma.goal.findMany({
        where: {
          monthId: previousMonthId,
          done: false,
        },
      }) as Array<{
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
      }>;

      if (unfinishedGoals.length > 0) {
        await prisma.goal.createMany({
          data: unfinishedGoals.map((goal) => ({
            name: goal.name,
            description: goal.description,
            current: goal.current,
            target: goal.target,
            done: false,
            deadline: goal.deadline,
            carriedOver: true,
            section: goal.section,
            monthId: newMonthRecord.id,
            authorId: goal.authorId,
            deadlineSetByAdmin: true,
          })),
        });
        carriedOver = unfinishedGoals.length;
        carriedGoalNames = unfinishedGoals.map((g) => g.name);
      }
    }

    /* Notify all users about the new month */
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    }) as Array<{ id: string }>;
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
      const carriedAssignments = await prisma.goal.findMany({
        where: { monthId: newMonthRecord.id, carriedOver: true },
        select: {
          assignments: { select: { userId: true } },
        },
      });
      const carriedUserIds = [...new Set(
        carriedAssignments.flatMap((g) => g.assignments.map((a) => a.userId))
      )];

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
