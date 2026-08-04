// GET /api/months — List all planning months (authenticated)

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const months = await prisma.month.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: {
      _count: { select: { goals: true } },
    },
  });

  return NextResponse.json({ months });
}
