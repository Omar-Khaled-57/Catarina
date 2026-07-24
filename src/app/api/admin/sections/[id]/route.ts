// PUT /api/admin/sections/[id] — Update a section (admin only)
// DELETE /api/admin/sections/[id] — Soft-delete a section (admin only)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { invalidateSectionCache } from "@/lib/sections";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { label, prefix, color, sortOrder, isActive } = body;

    const data: Record<string, string | number | boolean> = {};
    if (label !== undefined) data.label = label.trim();
    if (prefix !== undefined) data.prefix = prefix.toUpperCase();
    if (color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return NextResponse.json({ error: "Invalid hex color" }, { status: 400 });
      }
      data.color = color;
    }
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    /* Check prefix uniqueness if changing */
    if (prefix) {
      const existing = await prisma.sectionConfig.findFirst({
        where: { prefix: prefix.toUpperCase(), NOT: { id } },
      }) as { id: string } | null;
      if (existing) {
        return NextResponse.json({ error: "Prefix already in use" }, { status: 409 });
      }
    }

    const section = await prisma.sectionConfig.update({
      where: { id },
      data,
    });

    invalidateSectionCache();

    return NextResponse.json({ section });
  } catch (error) {
    console.error("[ADMIN_SECTION_PUT]", error);
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await params;

    /* Soft-delete: set isActive to false */
    const section = await prisma.sectionConfig.update({
      where: { id },
      data: { isActive: false },
    });

    invalidateSectionCache();

    return NextResponse.json({ section });
  } catch (error) {
    console.error("[ADMIN_SECTION_DELETE]", error);
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
}
