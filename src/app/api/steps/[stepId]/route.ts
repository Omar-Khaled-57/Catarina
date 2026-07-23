// PUT /api/steps/[stepId] — Update a step (toggle done, edit text, reorder)
// DELETE /api/steps/[stepId] — Delete a step

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stepId } = await params;
  const body = await req.json();

  const step = await prisma.step.update({
    where: { id: stepId },
    data: {
      ...(body.text !== undefined && { text: body.text }),
      ...(body.done !== undefined && { done: body.done }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  return NextResponse.json({ step });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stepId } = await params;
  await prisma.step.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
