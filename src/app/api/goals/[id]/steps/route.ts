// GET /api/goals/[id]/steps — List steps for a goal
// POST /api/goals/[id]/steps — Create a new step (section members; notifies assignees)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
  getUserContext,
  getGoalCapabilities,
  asString,
  asNonNegativeInt,
  jsonError,
} from "@/lib/api-helpers";
import { notifyMany } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, id);
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

  const limited = await checkRateLimit(
    `mutation:steps:${auth.data.userId}`,
    60,
    60_000
  );
  if (limited.limited) {
    return jsonError("Too many step additions, try again shortly", 429);
  }

  const { id } = await params;
  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, id);
  if (!access.ok) return access.response;

  /* Mirror the UI: adding a step is a content edit, gated by canEdit */
  const cap = await getGoalCapabilities(
    auth.data.userId,
    ctx.role,
    ctx.permissions,
    id
  );
  if (!cap.canEdit) {
    return jsonError("You don't have permission to add steps to this goal", 403);
  }

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
