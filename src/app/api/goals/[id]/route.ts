// GET    /api/goals/[id] — Fetch a single goal by ID (for notification deep links)
// PUT    /api/goals/[id] — Update a goal (section members with canEditGoals; admins for deadlines)
// DELETE /api/goals/[id] — Delete a goal (admin only)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin, requireGoalAccess, getUserContext, validateGoalFields, jsonError } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireGoalAccess(auth.data.userId, auth.data.role, id);
  if (!access.ok) return access.response;

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      comments: { select: { id: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, pfp: true } } },
      },
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!goal) {
    return jsonError("Goal not found", 404);
  }

  const formatted = {
    ...goal,
    deadline: goal.deadline.toISOString(),
    completedAt: goal.completedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    assignments: goal.assignments.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      pfp: a.user.pfp,
      canCheck: a.canCheck,
      canEdit: a.canEdit,
    })),
  };

  return NextResponse.json({ goal: formatted });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireGoalAccess(auth.data.userId, auth.data.role, id);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const fields = validateGoalFields(body as Record<string, unknown>);
  if (!fields.ok) return jsonError(fields.message, 400);

  /* Non-admins cannot change the deadline */
  if (auth.data.role !== ROLE_ADMIN && fields.data.deadline) {
    const existing = await prisma.goal.findUnique({
      where: { id },
      select: { deadline: true },
    });
    if (
      !existing ||
      existing.deadline.getTime() !== fields.data.deadline.getTime()
    ) {
      return jsonError("Only admins can change deadlines", 403);
    }
  }

  /* Members need canEditGoals to modify a goal's content */
  if (auth.data.role !== ROLE_ADMIN) {
    const ctx = await getUserContext(auth.data.userId);
    if (!ctx.permissions.canEditGoals) {
      return jsonError("You don't have permission to edit goals", 403);
    }
  }

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...(fields.data.name !== undefined && { name: fields.data.name }),
      ...(fields.data.description !== undefined && { description: fields.data.description }),
      ...(fields.data.current !== undefined && { current: fields.data.current }),
      ...(fields.data.target !== undefined && { target: fields.data.target }),
      ...(fields.data.deadline !== undefined && {
        deadline: fields.data.deadline,
        deadlineSetByAdmin: auth.data.role === ROLE_ADMIN,
      }),
    },
  });

  return NextResponse.json({ goal });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await prisma.goal.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
