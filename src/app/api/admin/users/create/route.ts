// POST /api/admin/users/create — Create a new user (admin only)

import { NextResponse } from "next/server";
import {
  requireAdmin,
  asString,
  asValidPassword,
  jsonError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getSectionKeys } from "@/lib/sections";
import {
  serializePermissions,
  DEFAULT_PERMISSIONS,
  type MemberPermissions,
} from "@/lib/permissions";
import { PERMISSION_KEYS } from "@/lib/constants";
import { MAX_IMAGE_SIZE, validateImageDataUri } from "@/lib/image";
import bcrypt from "bcryptjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const name = asString(body.name, 100);
  const emailRaw = asString(body.email, 200);
  if (!name) return jsonError("Name is required", 400);
  if (!emailRaw || !EMAIL_RE.test(emailRaw)) return jsonError("Valid email is required", 400);

  const pw = asValidPassword(body.password);
  if (!pw.ok) return jsonError(pw.message, 400);

  const email = emailRaw.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("Email already registered", 409);

  /* Permissions: only accept known keys, coerce values to booleans */
  const perms: MemberPermissions = { ...DEFAULT_PERMISSIONS };
  if (body.permissions && typeof body.permissions === "object") {
    for (const key of PERMISSION_KEYS) {
      const value = (body.permissions as Record<string, unknown>)[key];
      if (typeof value === "boolean") perms[key] = value;
    }
  }

  const hashedPassword = await bcrypt.hash(pw.password, 12);
  const userRole = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const pfp = asString(body.pfp ?? "", MAX_IMAGE_SIZE);
  if (pfp !== null && pfp !== "" && !validateImageDataUri(pfp)) {
    return jsonError("Invalid profile picture", 400);
  }
  const bio = asString(body.bio ?? "", 2000);

  const validSections = await getSectionKeys();
  const validSet = new Set(validSections);
  const rawSections: unknown[] = Array.isArray(body.sections) ? body.sections : [];
  const sections = [
    ...new Set(
      rawSections
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.toUpperCase())
        .filter((s) => validSet.has(s))
    ),
  ];

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        permissions: serializePermissions(perms),
        pfp: pfp ?? null,
        bio: bio ?? null,
      },
    });

    if (sections.length > 0) {
      await tx.userSection.createMany({
        data: sections.map((section) => ({ userId: newUser.id, section })),
      });
    }

    return newUser;
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      pfp: user.pfp,
      bio: user.bio,
      permissions: perms,
      sections,
    },
  }, { status: 201 });
}
