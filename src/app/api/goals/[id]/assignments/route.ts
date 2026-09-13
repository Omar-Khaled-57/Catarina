// GET /api/goals/[id]/assignments — List assignments for a goal (section members)
// PUT /api/goals/[id]/assignments — Replace all assignments for a goal (admin only)

import { NextResponse } from "next/server";
import {
  requireUser,
  requireAdmin,
  requireGoalAccess,
  getUserContext,
  asBoolean,
  jsonError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, id);
  if (!access.ok) return access.response;

  const assignments = await prisma.goalAssignment.findMany({
    where: { goalId: id },
    include: { user: { select: { id: true, name: true, pfp: true } } },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      pfp: a.user.pfp,
      canCheck: a.canCheck,
      canEdit: a.canEdit,
    })),
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.assignments)) {
    return jsonError("assignments must be an array", 400);
  }

  const assignments: { userId: string; canCheck: boolean; canEdit: boolean }[] = [];
  for (const a of body.assignments) {
    if (!a || typeof a.userId !== "string" || !a.userId.trim()) {
      return jsonError("Each assignment needs a valid userId", 400);
    }
    /* Strict booleans — never default canCheck/canEdit to true (would grant
     * capabilities to anyone the client "forgets" to express). */
    const canCheck = asBoolean(a.canCheck);
    const canEdit = asBoolean(a.canEdit);
    if (canCheck === null || canEdit === null) {
      return jsonError("canCheck and canEdit must be booleans for each assignment", 400);
    }
    assignments.push({ userId: a.userId, canCheck, canEdit });
  }

  /* Validate the users actually exist (avoid dangling FK failures mid-transaction) */
  if (assignments.length > 0) {
    const ids = [...new Set(assignments.map((a) => a.userId))];
    const count = await prisma.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length) {
      return jsonError("One or more users do not exist", 400);
    }
  }

  /* Replace all assignments in a transaction */
  await prisma.$transaction(async (tx) => {
    await tx.goalAssignment.deleteMany({ where: { goalId: id } });
    if (assignments.length > 0) {
      await tx.goalAssignment.createMany({
        data: assignments.map((a) => ({
          goalId: id,
          userId: a.userId,
          canCheck: a.canCheck,
          canEdit: a.canEdit,
        })),
      });
    }
  });

  return NextResponse.json({ success: true });
}
