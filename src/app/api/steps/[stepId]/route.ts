// PUT /api/steps/[stepId] — Update a step (toggle done, edit text, reorder)
// DELETE /api/steps/[stepId] — Delete a step
// Both require membership in the step's goal section (admin bypasses).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
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

  const access = await requireGoalAccess(auth.data.userId, auth.data.role, step.goalId);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
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

  const access = await requireGoalAccess(auth.data.userId, auth.data.role, step.goalId);
  if (!access.ok) return access.response;

  await prisma.step.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
