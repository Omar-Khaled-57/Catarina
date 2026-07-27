// GET    /api/goals/[id] — Fetch a single goal by ID (for notification deep links)
// PUT    /api/goals/[id] — Update a goal (admin only for deadline changes)
// DELETE /api/goals/[id] — Delete a goal (admin only)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
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
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, description, current, target, deadline } = await req.json();

  /* Fetch the existing goal to check permissions */
  const existing = await prisma.goal.findUnique({ where: { id } }) as {
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
  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  /* Non-admins cannot change the deadline */
  if (
    payload.role !== "ADMIN" &&
    deadline &&
    new Date(deadline).getTime() !== existing.deadline.getTime()
  ) {
    return NextResponse.json(
      { error: "Only admins can change deadlines" },
      { status: 403 }
    );
  }

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(current !== undefined && { current }),
      ...(target !== undefined && { target }),
      ...(deadline !== undefined && {
        deadline: new Date(deadline),
        deadlineSetByAdmin: payload.role === "ADMIN",
      }),
    },
  });

  return NextResponse.json({ goal });
}

export async function DELETE(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;
  await prisma.goal.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
