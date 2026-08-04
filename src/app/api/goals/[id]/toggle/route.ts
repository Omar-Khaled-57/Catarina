// PATCH /api/goals/[id]/toggle — Toggle the done status of a goal
// Sets completedAt timestamp when marking done; notifies assignees.
// Section membership is checked against live DB data (not the JWT snapshot).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
  asBoolean,
  jsonError,
} from "@/lib/api-helpers";
import { notifyMany, notifySection } from "@/lib/notify";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireGoalAccess(auth.data.userId, auth.data.role, id);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const done = asBoolean(body.done);
  if (done === null) return jsonError("Invalid done value", 400);

  const goal = await prisma.goal.findUnique({
    where: { id },
    select: { name: true, section: true, target: true, done: true, current: true },
  });
  if (!goal) return jsonError("Goal not found", 404);

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      done,
      completedAt: done ? new Date() : null,
      current: done ? goal.target : goal.current,
    },
  });

  if (done && !goal.done) {
    /* Notify assignees (excluding the completer) */
    const assignments = await prisma.goalAssignment.findMany({
      where: { goalId: id },
      select: { userId: true },
    });
    const assigneeIds = [...new Set(assignments.map((a) => a.userId))].filter(
      (uid) => uid !== auth.data.userId
    );
    if (assigneeIds.length > 0) {
      await notifyMany(assigneeIds, {
        type: "GOAL_COMPLETED",
        title: "Goal completed",
        message: `${auth.data.email} completed "${goal.name}".`,
        refId: id,
        refType: "goal",
      });
    }

    /* Notify the rest of the section (excluding the completer) that the target was reached */
    await notifySection(goal.section, {
      type: "GOAL_REACHED",
      title: "Goal target reached!",
      message: `"${goal.name}" has reached its target of ${goal.target}.`,
      refId: id,
      refType: "goal",
    }, auth.data.userId);
  }

  return NextResponse.json({ goal: updated });
}
