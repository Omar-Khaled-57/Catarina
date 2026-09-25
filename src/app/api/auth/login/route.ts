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
import { accountRateLimitKey, ipRateLimitKey } from "@/lib/rateLimitPolicy";
import { LOGIN_FAILURE_MESSAGE, verifyLoginPassword } from "@/lib/loginPolicy";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    /* Two independent layers. The IP layer is coarse and best-effort (it can't
       be keyed by a forged header any more — see @/lib/rateLimitPolicy); the
       ACCOUNT layer is the real anti-brute-force control, because its key is a
       hash of the email and no header can rotate it. Either one being over its
       limit rejects the attempt. */
    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(ipRateLimitKey("login", ip), 10, 60_000);
    if (ipLimit.limited) {
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

    /* Account layer — 10 attempts per 15 minutes for this email, shared across
       every IP, so neither a botnet nor a header rotation gets more than that
       against one account. Checked after the cheap IP gate so malformed bodies
       never reach bcrypt. */
    const accountLimit = await checkRateLimit(
      accountRateLimitKey("login", email),
      10,
      15 * 60_000,
    );
    if (accountLimit.limited) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
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

    /* Timing-safe credential check: exactly one bcrypt comparison runs whether
       or not the account exists, so response time can't be used to enumerate
       registered emails. Rejected/pending approvals, wrong password, and
       unknown email all land on the same 401 with the same message. */
    const isValid = await verifyLoginPassword(
      password,
      user?.password ?? null,
      bcrypt.compare,
    );
    if (!user || !isValid) {
      return NextResponse.json({ error: LOGIN_FAILURE_MESSAGE }, { status: 401 });
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
