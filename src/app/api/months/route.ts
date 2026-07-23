// GET /api/months — List all planning months

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const months = await prisma.month.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: {
      _count: { select: { goals: true } },
    },
  }) as Array<{
    id: string;
    name: string;
    year: number;
    month: number;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { goals: number };
  }>;

  return NextResponse.json({ months });
}
