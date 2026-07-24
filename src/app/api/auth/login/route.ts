// POST /api/auth/login — Authenticate user with email/password
// Sets HttpOnly JWT cookie on success
// Returns user with sections array from UserSection join table

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth.server";
import { parsePermissions } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { userSections: { select: { section: true } } },
    }) as {
      id: string;
      email: string;
      password: string;
      name: string;
      role: string;
      pfp: string | null;
      bio: string | null;
      primarySection: string | null;
      permissions: string;
      welcomeSeen: boolean;
      userSections: { section: string }[];
    } | null;

    if (!user) {
      /* Check if email exists as a rejected approval */
      const rejectedApproval = await prisma.approval.findFirst({
        where: { email, status: "REJECTED" },
      }) as { id: string } | null;
      if (rejectedApproval) {
        return NextResponse.json(
          { error: "Your signup request was rejected by an admin." },
          { status: 403 }
        );
      }

      /* Check if email exists as a pending approval */
      const pendingApproval = await prisma.approval.findFirst({
        where: { email, status: "PENDING" },
      }) as { id: string } | null;
      if (pendingApproval) {
        return NextResponse.json(
          { error: "Your account is still pending admin approval." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sections = user.userSections.map((us) => us.section);
    const primarySection = sections[0] || "MANAGEMENT";

    await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      section: primarySection,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        pfp: user.pfp,
        bio: user.bio,
        primarySection: user.primarySection,
        welcomeSeen: user.welcomeSeen,
        permissions: user.role === "ADMIN" ? { canCreateGoals: true, canEditGoals: true, canDeleteGoals: true, canManageMembers: true, canCreateMonths: true } : parsePermissions(user.permissions),
        sections,
      },
    });
  } catch (error) {
    console.error("[LOGIN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
