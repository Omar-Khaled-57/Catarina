// PUT /api/admin/users/[userId]/sections — Assign/remove sections for a user (admin only)
// Body: { sections: string[] } — replaces all section assignments

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { SECTIONS } from "@/lib/auth";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;
  const { sections } = await req.json();

  if (!Array.isArray(sections)) {
    return NextResponse.json({ error: "sections must be an array" }, { status: 400 });
  }

  /* Validate all section values */
  const validSet = new Set(SECTIONS);
  const invalid = sections.filter((s: string) => !validSet.has(s as typeof SECTIONS[number]));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid sections: ${invalid.join(", ")}` }, { status: 400 });
  }

  /* Replace all section assignments in a transaction */
  await prisma.$transaction(async (tx) => {
    await tx.userSection.deleteMany({ where: { userId } });
    if (sections.length > 0) {
      await tx.userSection.createMany({
        data: sections.map((section: string) => ({ userId, section })),
      });
    }
  });

  return NextResponse.json({ sections });
}
