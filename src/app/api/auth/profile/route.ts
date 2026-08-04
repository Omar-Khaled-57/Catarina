// PUT /api/auth/profile — Update own profile (name, email, pfp, bio, password)
// Any authenticated user can update their own profile.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  requireUser,
  asString,
  jsonError,
} from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rateLimit";

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 200; // guards against bcrypt DoS on absurd inputs

export async function PUT(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const data: Record<string, string | null> = {};

  if (body.name !== undefined) {
    const name = asString(body.name, 100);
    if (!name) return jsonError("Invalid name", 400);
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = asString(body.email, 200);
    if (!email) return jsonError("Invalid email", 400);
    data.email = email;
  }

  if (body.pfp !== undefined) {
    if (body.pfp === "") {
      data.pfp = null; /* allow clearing the picture */
    } else {
      const pfp = asString(body.pfp, 2_000_000);
      if (pfp === null) return jsonError("Invalid profile picture", 400);
      data.pfp = pfp;
    }
  }

  if (body.bio !== undefined) {
    const bio = asString(body.bio, 2000);
    if (bio === null) return jsonError("Invalid bio", 400);
    data.bio = bio;
  }

  /* Handle password change */
  if (body.newPassword) {
    const limited = await checkRateLimit(
      `profile:password:${auth.data.userId}`,
      5,
      60_000
    );
    if (limited.limited) {
      return jsonError("Too many password attempts, try again shortly", 429);
    }

    const currentPassword = asString(body.currentPassword, PASSWORD_MAX);
    const newPassword = asString(body.newPassword, PASSWORD_MAX);
    if (!newPassword) {
      return jsonError("Invalid new password", 400);
    }
    if (newPassword.length < PASSWORD_MIN) {
      return jsonError(
        `New password must be at least ${PASSWORD_MIN} characters`,
        400
      );
    }
    if (!currentPassword) {
      return jsonError("Current password is required to change password", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.data.userId },
      select: { password: true },
    });
    if (!user) {
      return jsonError("User not found", 404);
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return jsonError("Current password is incorrect", 403);
    }

    data.password = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  /* Check email uniqueness if changing */
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: auth.data.userId } },
      select: { id: true },
    });
    if (existing) {
      return jsonError("Email already in use", 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: auth.data.userId },
    data,
    select: { id: true, name: true, email: true, pfp: true, bio: true },
  });

  return NextResponse.json({ user });
}
