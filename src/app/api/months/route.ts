// GET /api/months — List all planning months (authenticated)

import { NextResponse } from "next/server";
import { databaseUnavailableResponse, requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/databaseError";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const months = await prisma.month.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }],
      include: { _count: { select: { goals: true } } },
    });
    return NextResponse.json({ months });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return databaseUnavailableResponse();
    throw error;
  }
}
