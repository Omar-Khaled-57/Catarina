// GET /api/goals/[id]/comments — List comments for a goal
// POST /api/goals/[id]/comments — Add a comment to a goal

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const comments = await prisma.comment.findMany({
    where: { goalId: id },
    include: {
      author: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json(
      { error: "Comment text is required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      text: text.trim(),
      goalId: id,
      authorId: payload.userId,
    },
    include: {
      author: { select: { name: true, role: true } },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
