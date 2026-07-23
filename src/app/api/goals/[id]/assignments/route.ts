// GET /api/goals/[id]/assignments — List assignments for a goal
// PUT /api/goals/[id]/assignments — Replace all assignments for a goal (admin only)

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
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const { assignments } = await req.json();

  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: "assignments must be an array" }, { status: 400 });
  }

  /* Replace all assignments in a transaction */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.goalAssignment.deleteMany({ where: { goalId: id } });

    if (assignments.length > 0) {
      await tx.goalAssignment.createMany({
        data: assignments.map((a: { userId: string; canCheck?: boolean; canEdit?: boolean }) => ({
          goalId: id,
          userId: a.userId,
          canCheck: a.canCheck ?? true,
          canEdit: a.canEdit ?? false,
        })),
      });
    }
  });

  return NextResponse.json({ success: true });
}
