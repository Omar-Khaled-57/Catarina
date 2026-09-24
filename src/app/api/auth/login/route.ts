// POST /api/auth/login — Authenticate user with email/password
// Sets HttpOnly JWT cookie on success
// Returns user with sections array from UserSection join table
// Rate limited: 10 attempts per minute per IP

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth.server";
import { generateRefreshToken } from "@/lib/refreshToken";
import { buildAuthUser } from "@/lib/auth-session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    /* Rate limit: 10 login attempts per minute */
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`login:${ip}`, 10, 60_000);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }
    const { email: emailRaw, password } = await req.json();

    if (!emailRaw || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    /* Normalize case so login matches the lowercased emails stored by register */
    const email = String(emailRaw).trim().toLowerCase();

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
      /* Rejected/pending approvals, wrong password, unknown email — all get
       * the same generic error so the endpoint can't be used to enumerate
       * accounts or probe approval state. */
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

    /* Long-lived per-device token the client keeps in localStorage so the
       session cookie can be silently re-issued on future visits. */
    const refreshToken = await generateRefreshToken(user.id);

    return NextResponse.json({
      user: buildAuthUser(user),
      refreshToken,
    });
  } catch (error) {
    console.error("[LOGIN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
