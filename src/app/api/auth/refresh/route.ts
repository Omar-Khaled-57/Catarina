// POST /api/auth/refresh — Silently re-issue the session cookie from a
// long-lived per-device refresh token (stored in the client's localStorage).
// Returns a fresh JWT cookie + the current user, mirroring /api/auth/login.
// Used on every app load when the session cookie has expired.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth.server";
import { verifyRefreshToken } from "@/lib/refreshToken";
import { buildAuthUser } from "@/lib/auth-session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    /* Rate limit: 10 refresh exchanges per minute per IP — parity with login
     * (10/min) so an attacker who can't brute the session cookie can't harvest
     * refresh tokens faster than they could brute a password. */
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`refresh:${ip}`, 10, 60_000);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { refreshToken } = await req.json().catch(() => ({}));

    if (typeof refreshToken !== "string" || !refreshToken) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    /* Fail-closed: unknown, revoked, or orphaned tokens all answer 401 with
       the same generic message so the endpoint can't probe token state. */
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userSections: { select: { section: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const primarySection = user.userSections[0]?.section || "MANAGEMENT";
    await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      section: primarySection,
    });

    return NextResponse.json({ user: buildAuthUser(user) });
  } catch (error) {
    console.error("[REFRESH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}