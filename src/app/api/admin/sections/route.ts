// POST /api/admin/sections — Create a new section (admin only)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { invalidateSectionCache } from "@/lib/sections";

export async function POST(req: Request) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { key, label, prefix, color } = await req.json();

    if (!key || !label || !prefix || !color) {
      return NextResponse.json(
        { error: "Key, label, prefix, and color are required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase().trim();

    /* Validate key format (letters only) */
    if (!/^[A-Z]{2,}$/.test(normalizedKey)) {
      return NextResponse.json(
        { error: "Key must be 2+ uppercase letters (e.g. MARKETING)" },
        { status: 400 }
      );
    }

    /* Validate prefix format */
    if (!/^[A-Z]{2,}-$/.test(prefix.toUpperCase())) {
      return NextResponse.json(
        { error: "Prefix must be 2+ uppercase letters followed by a dash (e.g. MRK-)" },
        { status: 400 }
      );
    }

    /* Validate hex color */
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (e.g. #FF4D6A)" },
        { status: 400 }
      );
    }

    /* Check for existing key */
    const existing = await prisma.sectionConfig.findUnique({
      where: { key: normalizedKey },
    }) as { id: string } | null;
    if (existing) {
      return NextResponse.json(
        { error: `A section with key "${normalizedKey}" already exists` },
        { status: 409 }
      );
    }

    /* Get max sortOrder */
    const maxSort = await prisma.sectionConfig.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    }) as { sortOrder: number } | null;

    const section = await prisma.sectionConfig.create({
      data: {
        key: normalizedKey,
        label: label.trim(),
        prefix: prefix.toUpperCase(),
        color,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    invalidateSectionCache();

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_SECTIONS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
