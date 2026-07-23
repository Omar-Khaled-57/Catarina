// POST /api/months/create — Create a new planning month
// Automatically carries over unfinished goals from the previous month

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { previousMonthId } = await req.json();

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
