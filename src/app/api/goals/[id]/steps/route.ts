// GET /api/goals/[id]/steps — List steps for a goal
// POST /api/goals/[id]/steps — Create a new step (section members; notifies assignees)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
  asString,
  asNonNegativeInt,
  jsonError,
} from "@/lib/api-helpers";
import { notifyMany } from "@/lib/notify";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireGoalAccess(auth.data.userId, auth.data.role, id);
  if (!access.ok) return access.response;

  const steps = await prisma.step.findMany({
    where: { goalId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ steps });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireGoalAccess(auth.data.userId, auth.data.role, id);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const text = asString(body.text, 500);
  if (!text) return jsonError("Text is required", 400);

  const order = body.order === undefined ? null : asNonNegativeInt(body.order);
  if (order === null && body.order !== undefined) {
    return jsonError("Invalid order value", 400);
  }

  const step = await prisma.step.create({
    data: {
      text,
      order: order ?? 0,
      goalId: id,
    },
  });

  /* Notify goal assignees about the new step */
  const goal = await prisma.goal.findUnique({
    where: { id },
    select: {
      name: true,
      assignments: { select: { userId: true } },
    },
  });

  if (goal) {
    const assigneeIds = goal.assignments
      .map((a) => a.userId)
      .filter((uid) => uid !== auth.data.userId);
    if (assigneeIds.length > 0) {
      await notifyMany(assigneeIds, {
        type: "STEP_ADDED",
        title: "New step added",
        message: `${auth.data.email} added a step to "${goal.name}".`,
        refId: id,
        refType: "goal",
      });
    }
  }

  return NextResponse.json({ step }, { status: 201 });
}
