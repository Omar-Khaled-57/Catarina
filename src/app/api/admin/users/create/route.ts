// POST /api/admin/users/create — Create a new user (admin only)

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { SECTIONS } from "@/lib/auth";
import { serializePermissions, type MemberPermissions, DEFAULT_PERMISSIONS } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { name, email, password, role, sections, permissions, pfp, bio } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = role === "ADMIN" ? "ADMIN" : "MEMBER";
    const perms = permissions && typeof permissions === "object"
      ? { ...DEFAULT_PERMISSIONS, ...permissions }
      : DEFAULT_PERMISSIONS;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: userRole,
          permissions: serializePermissions(perms as MemberPermissions),
          pfp: pfp || null,
          bio: bio || null,
        },
      });

      if (Array.isArray(sections) && sections.length > 0) {
        const validSet = new Set(SECTIONS);
        const validSections = sections.filter((s: string) => validSet.has(s as typeof SECTIONS[number]));
        if (validSections.length > 0) {
          await tx.userSection.createMany({
            data: validSections.map((section: string) => ({ userId: newUser.id, section })),
          });
        }
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
        sections: sections || [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_USER_CREATE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
