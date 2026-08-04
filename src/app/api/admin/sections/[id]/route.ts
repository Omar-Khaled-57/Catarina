// PUT /api/admin/sections/[id] — Update a section (admin only)
// DELETE /api/admin/sections/[id] — Soft-delete a section (admin only)

import { NextResponse } from "next/server";
import { requireAdmin, jsonError, asNonNegativeInt, asBoolean } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { invalidateSectionCache } from "@/lib/sections";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body", 400);
    }
    const { label, prefix, color, sortOrder, isActive } = body;

    const data: Record<string, string | number | boolean> = {};
    if (label !== undefined) {
      const normalizedLabel = String(label).trim();
      if (!normalizedLabel || normalizedLabel.length > 60) {
        return jsonError("Label must be 1-60 characters", 400);
      }
      data.label = normalizedLabel;
    }
    if (prefix !== undefined) {
      const normalizedPrefix = String(prefix).toUpperCase().trim();
      if (!/^[A-Z]{2,}-$/.test(normalizedPrefix) || normalizedPrefix.length > 8) {
        return jsonError("Invalid prefix format", 400);
      }
      data.prefix = normalizedPrefix;
    }
    if (color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return jsonError("Invalid hex color", 400);
      }
      data.color = color;
    }
    if (sortOrder !== undefined) {
      const n = asNonNegativeInt(sortOrder);
      if (n === null) return jsonError("Invalid sortOrder", 400);
      data.sortOrder = n;
    }
    if (isActive !== undefined) {
      const b = asBoolean(isActive);
      if (b === null) return jsonError("Invalid isActive", 400);
      data.isActive = b;
    }

    /* Check prefix uniqueness if changing */
    if (data.prefix) {
      const existing = await prisma.sectionConfig.findFirst({
        where: { prefix: data.prefix as string, NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        return jsonError("Prefix already in use", 409);
      }
    }

    const section = await prisma.sectionConfig.update({
      where: { id },
      data,
    });

    invalidateSectionCache();

    return NextResponse.json({ section });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return jsonError("Section not found", 404);
    }
    console.error("[ADMIN_SECTION_PUT]", error);
    return jsonError("Failed to update section", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return jsonError("Section not found", 404);
    }
    console.error("[ADMIN_SECTION_DELETE]", error);
    return jsonError("Failed to delete section", 500);
  }
}
