// PUT /api/auth/profile — Update own profile (name, email, pfp, bio, password)
// Any authenticated user can update their own profile.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  requireUser,
  asString,
  asValidPassword,
  jsonError,
} from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rateLimit";
import { MAX_IMAGE_SIZE, validateImageDataUri } from "@/lib/image";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const data: Record<string, string | null> = {};
  /* Set when this request changes the password, so the session-invalidation
     bump is merged into the same UPDATE as the new hash. */
  let bumpSessionVersion = false;

  if (body.name !== undefined) {
    const name = asString(body.name, 100);
    if (!name) return jsonError("Invalid name", 400);
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = asString(body.email, 200);
    if (!email || !EMAIL_RE.test(email)) return jsonError("Valid email is required", 400);
    data.email = email.toLowerCase(); /* normalize like register/login */
  }

  if (body.pfp !== undefined) {
    if (body.pfp === "") {
      data.pfp = null; /* allow clearing the picture */
    } else {
      const pfp = asString(body.pfp, MAX_IMAGE_SIZE);
      if (pfp === null || !validateImageDataUri(pfp)) {
        return jsonError("Invalid profile picture", 400);
      }
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

    const currentPassword = asString(body.currentPassword, 200);
    const newPw = asValidPassword(body.newPassword);
    if (!newPw.ok) {
      return jsonError(newPw.message, 400);
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

    data.password = await bcrypt.hash(newPw.password, 12);
    /* Changing the password must end every other session — including one held
       by whoever prompted the change after a compromise. Bumping
       `sessionVersion` invalidates all outstanding JWT cookies (they carry the
       older value), and revoking the refresh tokens stops the localStorage
       credentials from silently re-issuing a fresh cookie. The version bump is
       merged into the same UPDATE below so the new password and the session
       revocation can never land apart. */
    bumpSessionVersion = true;
    await prisma.refreshToken.updateMany({
      where: { userId: auth.data.userId, revoked: false },
      data: { revoked: true },
    });
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

  try {
    const user = await prisma.user.update({
      where: { id: auth.data.userId },
      data: bumpSessionVersion
        ? { ...data, sessionVersion: { increment: 1 } }
        : data,
      select: { id: true, name: true, email: true, pfp: true, bio: true },
    });

    return NextResponse.json({ user, passwordChanged: bumpSessionVersion });
  } catch (error) {
    /* The check above can race; catch the unique violation directly. */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Email already in use", 409);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return jsonError("User not found", 404);
    }
    console.error("[PROFILE_UPDATE]", error);
    return jsonError("Failed to update profile", 500);
  }
}
