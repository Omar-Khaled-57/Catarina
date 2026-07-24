// PUT /api/auth/profile — Update own profile (name, email, pfp, bio, password)
// Any authenticated user can update their own profile

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, pfp, bio, currentPassword, newPassword } = await req.json();

  const data: Record<string, string | null> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email || null;
  if (pfp !== undefined) data.pfp = pfp || null;
  if (bio !== undefined) data.bio = bio || null;

  /* Handle password change */
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change password" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { password: true },
    }) as { password: string } | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    data.password = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  /* Check email uniqueness if changing */
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: payload.userId } },
    }) as {
      id: string;
      email: string;
    } | null;
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id: payload.userId },
    data,
    select: { id: true, name: true, email: true, pfp: true, bio: true },
  });

  return NextResponse.json({ user });
}
