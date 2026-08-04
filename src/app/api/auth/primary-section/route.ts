// PUT /api/auth/primary-section — Update the admin's highlighted section
// Only admins can set this; members use all their sections for highlighting

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getSectionKeys } from "@/lib/sections";

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const section = typeof body?.section === "string" ? body.section : null;
  const validSections = await getSectionKeys();

  if (!section || !validSections.includes(section)) {
    return jsonError("Invalid section", 400);
  }

  await prisma.user.update({
    where: { id: auth.data.userId },
    data: { primarySection: section },
  });

  return NextResponse.json({ primarySection: section });
}
