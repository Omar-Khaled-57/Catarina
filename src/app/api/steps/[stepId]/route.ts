// PUT /api/steps/[stepId] — Update a step (toggle done, edit text, reorder)
// DELETE /api/steps/[stepId] — Delete a step
// Both require membership in the step's goal section (admin bypasses).
// Permission split: content edits (text/order) and deletion need canEdit;
// the done-toggle only needs canCheck. Mirrors StepsChecklist/GoalCard.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
  getUserContext,
  getGoalCapabilities,
  asString,
  asBoolean,
  asNonNegativeInt,
  jsonError,
} from "@/lib/api-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { stepId } = await params;
  const step = await prisma.step.findUnique({ where: { id: stepId } });
  if (!step) return jsonError("Step not found", 404);

  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, step.goalId);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const hasText = body.text !== undefined;
  const hasOrder = body.order !== undefined;
  const hasDone = body.done !== undefined;
  if (!hasText && !hasOrder && !hasDone) {
    return jsonError("Nothing to update", 400);
  }

  /* Content edits require canEdit; the done-toggle only needs canCheck. */
  const cap = await getGoalCapabilities(
    auth.data.userId,
    ctx.role,
    ctx.permissions,
    step.goalId
  );
  if ((hasText || hasOrder) && !cap.canEdit) {
    return jsonError("You don't have permission to edit steps on this goal", 403);
  }
  if (hasDone && !cap.canCheck) {
    return jsonError("You don't have permission to check steps on this goal", 403);
  }

  const data: { text?: string; done?: boolean; order?: number } = {};
  if (body.text !== undefined) {
    const text = asString(body.text, 500);
    if (!text) return jsonError("Invalid step text", 400);
    data.text = text;
  }
  if (body.done !== undefined) {
    const done = asBoolean(body.done);
    if (done === null) return jsonError("Invalid done value", 400);
    data.done = done;
  }
  if (body.order !== undefined) {
    const order = asNonNegativeInt(body.order);
    if (order === null) return jsonError("Invalid order value", 400);
    data.order = order;
  }

  const updated = await prisma.step.update({
    where: { id: stepId },
    data,
  });

  return NextResponse.json({ step: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { stepId } = await params;
  const step = await prisma.step.findUnique({ where: { id: stepId } });
  if (!step) return jsonError("Step not found", 404);

  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, step.goalId);
  if (!access.ok) return access.response;

  const cap = await getGoalCapabilities(
    auth.data.userId,
    ctx.role,
    ctx.permissions,
    step.goalId
  );
  if (!cap.canEdit) {
    return jsonError("You don't have permission to delete steps on this goal", 403);
  }

  await prisma.step.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
