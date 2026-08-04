// PUT /api/admin/users/[userId]/sections — Assign/remove sections for a user (admin only)
// Body: { sections: string[] } — replaces all section assignments

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { notify, notifySection } from "@/lib/notify";
import { getSectionKeys } from "@/lib/sections";

interface Params {
  params: Promise<{ userId: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.sections)) {
    return jsonError("sections must be an array", 400);
  }

  /* Normalize to uppercase, dedupe, and validate against dynamic sections */
  const validSections = await getSectionKeys();
  const validSet = new Set(validSections);
  const rawSections: unknown[] = body.sections;
  const sections = [
    ...new Set(
      rawSections
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().toUpperCase())
    ),
  ];
  const invalid = sections.filter((s) => !validSet.has(s));
  if (invalid.length > 0) {
    return jsonError(`Invalid sections: ${invalid.join(", ")}`, 400);
  }

  /* Get previous section assignments for diff */
  const prevSections = await prisma.userSection.findMany({
    where: { userId },
    select: { section: true },
  });
  const prevSet = new Set(prevSections.map((s) => s.section));
  const newSet = new Set(sections);
  const removedSections = [...prevSet].filter((s) => !newSet.has(s));

  /* Replace all section assignments in a transaction */
  await prisma.$transaction(async (tx) => {
    await tx.userSection.deleteMany({ where: { userId } });
    if (sections.length > 0) {
      await tx.userSection.createMany({
        data: sections.map((section) => ({ userId, section })),
      });
    }
  });

  /* Notify user and section members about removed sections */
  if (removedSections.length > 0) {
    const removedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

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
