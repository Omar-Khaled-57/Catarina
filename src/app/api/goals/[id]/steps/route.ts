// GET /api/goals/[id]/steps — List steps for a goal
// POST /api/goals/[id]/steps — Create a new step (notifies goal assignees)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { text, order } = await req.json();

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
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
    const assigneeIds = goal.assignments.map((a) => a.userId).filter((uid) => uid !== payload.userId);
    if (assigneeIds.length > 0) {
      const author = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      });
      await notifyMany(assigneeIds, {
        type: "STEP_ADDED",
        title: "New step added",
        message: `${author?.name || "Someone"} added a step to "${goal.name}".`,
        refId: id,
        refType: "goal",
      });
    }
  }

  return NextResponse.json({ step }, { status: 201 });
}
