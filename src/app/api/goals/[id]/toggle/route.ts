// PATCH /api/goals/[id]/toggle — Toggle the done status of a goal
// Sets completedAt timestamp when marking done; notifies assignees

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { done } = await req.json();

  const goal = await prisma.goal.findUnique({ where: { id } }) as {
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
  } | null;
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  /* Non-admins can only toggle their own section's goals */
  if (
    payload.role !== "ADMIN" &&
    goal.section !== payload.section
  ) {
    return NextResponse.json(
      { error: "Can only toggle goals in your section" },
      { status: 403 }
    );
  }

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      done,
      completedAt: done ? new Date() : null,
      current: done ? goal.target : goal.current,
    },
  });

  /* Notify assignees when goal is completed */
  if (done && !goal.done) {
    const assignments = await prisma.goalAssignment.findMany({
      where: { goalId: id },
      select: { userId: true },
    }) as Array<{ userId: string }>;
    const assigneeIds = assignments.map((a) => a.userId).filter((uid) => uid !== payload.userId);
    if (assigneeIds.length > 0) {
      const completer = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      }) as { name: string } | null;
      await notifyMany(assigneeIds, {
        type: "GOAL_COMPLETED",
        title: "Goal completed",
        message: `${completer?.name || "Someone"} completed "${goal.name}".`,
        refId: id,
        refType: "goal",
      });
    }
  }

  /* Notify when goal reaches 100% target (even if not toggled done) */
  if (done && !goal.done) {
    /* Goal just marked as done — GOAL_REACHED for section members */
    const sectionMembers = await prisma.userSection.findMany({
      where: { section: goal.section },
      select: { userId: true },
    }) as Array<{ userId: string }>;
    const sectionUserIds = [...new Set(sectionMembers.map((m) => m.userId))].filter(
      (uid) => uid !== payload.userId
    );
    if (sectionUserIds.length > 0) {
      await notifyMany(sectionUserIds, {
        type: "GOAL_REACHED",
        title: "Goal target reached!",
        message: `"${goal.name}" has reached its target of ${goal.target}.`,
        refId: id,
        refType: "goal",
      });
    }
  }

  return NextResponse.json({ goal: updated });
}
