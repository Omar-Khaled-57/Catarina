// PUT /api/admin/users/[userId]/sections — Assign/remove sections for a user (admin only)
// Body: { sections: string[] } — replaces all section assignments

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notify, notifySection } from "@/lib/notify";
import { getSectionKeys } from "@/lib/sections";

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

  /* Validate all section values against dynamic sections */
  const validSections = await getSectionKeys();
  const validSet = new Set(validSections);
  const invalid = sections.filter((s: string) => !validSet.has(s.toUpperCase()));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid sections: ${invalid.join(", ")}` }, { status: 400 });
  }

  /* Get previous section assignments for diff */
  const prevSections = await prisma.userSection.findMany({
    where: { userId },
    select: { section: true },
  }) as Array<{ section: string }>;
  const prevSet = new Set(prevSections.map((s) => s.section));
  const newSet = new Set(sections);
  const removedSections = [...prevSet].filter((s) => !newSet.has(s));

  /* Replace all section assignments in a transaction */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.userSection.deleteMany({ where: { userId } });
    if (sections.length > 0) {
      await tx.userSection.createMany({
        data: sections.map((section: string) => ({ userId, section })),
      });
    }
  });

  /* Notify user and section members about removed sections */
  if (removedSections.length > 0) {
    const removedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }) as { name: string } | null;

    /* Notify the user who was removed */
    await notify({
      userId,
      type: "MEMBER_LEFT_SECTION",
      title: "Removed from section",
      message: `You have been removed from the ${removedSections.join(", ")} section${removedSections.length > 1 ? "s" : ""}.`,
      refId: userId,
      refType: "user",
    });

    /* Notify remaining section members */
    for (const section of removedSections) {
      await notifySection(section, {
        type: "MEMBER_LEFT_SECTION",
        title: "Member left section",
        message: `${removedUser?.name || "A member"} has been removed from the ${section} section.`,
        refId: userId,
        refType: "user",
      });
    }
  }

  return NextResponse.json({ sections });
}
