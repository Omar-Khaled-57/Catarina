// GET /api/goals/[id]/comments — List comments for a goal
// POST /api/goals/[id]/comments — Add a comment to a goal

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

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
  }) as Array<{
    id: string;
    text: string;
    goalId: string;
    authorId: string;
    author: { name: string; role: string };
    createdAt: Date;
  }>;

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

  /* Notify section members + admins about the new comment */
  const goal = await prisma.goal.findUnique({
    where: { id },
    select: {
      name: true,
      section: true,
    },
  }) as {
    name: string;
    section: string;
  } | null;

  if (goal) {
    const authorName = comment.author?.name || "Someone";

    /* Get all members of this goal's section */
    const sectionMembers = await prisma.userSection.findMany({
      where: { section: goal.section },
      select: { userId: true },
    }) as Array<{ userId: string }>;

    /* Get all admins */
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    }) as Array<{ id: string }>;

    /* Combine and deduplicate, excluding the comment author */
    const notifyIds = [
      ...new Set([
        ...sectionMembers.map((m) => m.userId),
        ...admins.map((a) => a.id),
      ]),
    ].filter((uid) => uid !== payload.userId);

    if (notifyIds.length > 0) {
      await notifyMany(notifyIds, {
        type: "COMMENT_ADDED",
        title: "New comment on goal",
        message: `${authorName} commented on "${goal.name}" in ${goal.section}.`,
        refId: id,
        refType: "goal",
      });
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
