// GET /api/admin/sections — List all sections including inactive (admin only)
// POST /api/admin/sections — Create a new section (admin only)

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { invalidateSectionCache } from "@/lib/sections";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sections = await prisma.sectionConfig.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ sections });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body", 400);
    }

    const { key, label, prefix, color } = body;

    if (!key || !label || !prefix || !color) {
      return jsonError(
        "Key, label, prefix, and color are required",
        400
      );
    }

    const normalizedKey = String(key).toUpperCase().trim();
    const normalizedLabel = String(label).trim();
    const normalizedPrefix = String(prefix).toUpperCase().trim();

    if (!normalizedKey || normalizedKey.length > 12) {
      return jsonError("Key must be 2-12 uppercase letters (e.g. MARKETING)", 400);
    }
    if (!normalizedLabel || normalizedLabel.length > 60) {
      return jsonError("Label must be 1-60 characters", 400);
    }
    if (!normalizedPrefix || normalizedPrefix.length > 8) {
      return jsonError("Prefix must be 2-8 characters followed by a dash (e.g. MRK-)", 400);
    }

    /* Validate key format (letters only) */
    if (!/^[A-Z]{2,}$/.test(normalizedKey)) {
      return jsonError(
        "Key must be 2+ uppercase letters (e.g. MARKETING)",
        400
      );
    }

    /* Validate prefix format */
    if (!/^[A-Z]{2,}-$/.test(normalizedPrefix)) {
      return jsonError(
        "Prefix must be 2+ uppercase letters followed by a dash (e.g. MRK-)",
        400
      );
    }

    /* Validate hex color */
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return jsonError(
        "Color must be a valid hex color (e.g. #FF4D6A)",
        400
      );
    }

    /* Check for existing key */
    const existing = await prisma.sectionConfig.findUnique({
      where: { key: normalizedKey },
      select: { id: true },
    });
    if (existing) {
      return jsonError(`A section with key "${normalizedKey}" already exists`, 409);
    }

    /* Get max sortOrder */
    const maxSort = await prisma.sectionConfig.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const section = await prisma.sectionConfig.create({
      data: {
        key: normalizedKey,
        label: normalizedLabel,
        prefix: normalizedPrefix,
        color,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    invalidateSectionCache();

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_SECTIONS_POST]", error);
    return jsonError("Internal server error", 500);
  }
}
