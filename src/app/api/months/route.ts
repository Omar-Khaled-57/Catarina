// GET /api/months — List all planning months

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const months = await prisma.month.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: {
      _count: { select: { goals: true } },
    },
  });

  return NextResponse.json({ months });
}
