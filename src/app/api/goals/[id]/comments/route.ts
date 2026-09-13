// GET /api/goals/[id]/comments — List comments for a goal
// POST /api/goals/[id]/comments — Add a comment to a goal (section members)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireGoalAccess,
  getUserContext,
  asString,
  jsonError,
} from "@/lib/api-helpers";
import { notifySection, notifyAdmins } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rateLimit";

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
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  /* Comment flood guard — per-user cap. */
  const limited = await checkRateLimit(
    `mutation:comments:${auth.data.userId}`,
    60,
    60_000
  );
  if (limited.limited) {
    return jsonError("Too many comments, try again shortly", 429);
  }

  const { id } = await params;
  const ctx = await getUserContext(auth.data.userId);
  const access = await requireGoalAccess(auth.data.userId, ctx.role, id);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const text = asString(body.text, 2000);
  if (!text) return jsonError("Comment text is required", 400);

  const comment = await prisma.comment.create({
    data: {
      text,
      goalId: id,
      authorId: auth.data.userId,
    },
    include: {
      author: { select: { name: true, role: true } },
    },
  });

  /* Notify section members + admins about the new comment */
  const goal = await prisma.goal.findUnique({
    where: { id },
    select: { name: true, section: true },
  });

  if (goal) {
    const authorName = comment.author?.name || "Someone";
    await Promise.all([
      notifySection(goal.section, {
        type: "COMMENT_ADDED",
        title: "New comment on goal",
        message: `${authorName} commented on "${goal.name}" in ${goal.section}.`,
        refId: id,
        refType: "goal",
      }, auth.data.userId),
      notifyAdmins({
        type: "COMMENT_ADDED",
        title: "New comment on goal",
        message: `${authorName} commented on "${goal.name}" in ${goal.section}.`,
        refId: id,
        refType: "goal",
      }),
    ]);
  }

  return NextResponse.json({ comment }, { status: 201 });
}
