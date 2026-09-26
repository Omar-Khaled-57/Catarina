// POST /api/auth/login — Authenticate user with email/password
// Sets HttpOnly JWT cookie on success
// Returns user with sections array from UserSection join table
// Rate limited: 10 attempts per minute per IP, plus 10 FAILED attempts per
// 15 minutes per account (see runLoginAttempt for why the order matters)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth.server";
import { generateRefreshToken } from "@/lib/refreshToken";
import { buildAuthUser } from "@/lib/auth-session";
import { checkRateLimit, clearRateLimit, getClientIp, peekRateLimit } from "@/lib/rateLimit";
import {
  accountRateLimitKey,
  ipRateLimitKey,
  scaleForSharedBucket,
} from "@/lib/rateLimitPolicy";
import { LOGIN_FAILURE_MESSAGE, verifyLoginPassword } from "@/lib/loginPolicy";
import { runLoginAttempt } from "@/lib/loginAttempt";
import bcrypt from "bcryptjs";

/** Failed attempts allowed per account before the password is refused outright. */
const ACCOUNT_MAX_FAILURES = 10;
/** How long those failures are remembered. */
const ACCOUNT_WINDOW_MS = 15 * 60_000;

type AuthUser = {
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
  sessionVersion: number;
  userSections: { section: string }[];
};

/** The account row the login flow needs, or null when there is no such email. */
async function lookupUser(email: string): Promise<AuthUser | null> {
  return (await prisma.user.findUnique({
    where: { email },
    include: { userSections: { select: { section: true } } },
  })) as AuthUser | null;
}

export async function POST(req: Request) {
  try {
    /* Two independent layers. The IP layer is coarse and best-effort (it can't
       be keyed by a forged header any more — see @/lib/rateLimitPolicy); the
       ACCOUNT layer is the real anti-brute-force control, because its key is a
       hash of the email and no header can rotate it. */
    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(
      ipRateLimitKey("login", ip),
      scaleForSharedBucket(10, ip),
      60_000,
    );
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

    /* The ORDER of operations is the security property, and runLoginAttempt
       enforces it: gate the account BEFORE the password is checked, charge only
       genuine failures, clear the history on success.

       Gating first is what makes the 11th guess fail whether it is right or
       wrong. This used to run on the failure branch only, so a correct password
       never consulted the counter at all — it was a counter, not a lockout, and a
       patient distributed attacker was never stopped.

       The trade-off is deliberate: someone who knows an address can lock it for
       the rest of the window with 10 wrong passwords. That bounded, self-healing
       lockout is the cost of preventing a distributed brute force; never
       blocking protects nothing. Because only failures are charged, a correct
       password never consumes budget, so ordinary sign-ins cannot self-lock. */
    const accountKey = accountRateLimitKey("login", email, process.env.JWT_SECRET ?? "");

    const attempt = await runLoginAttempt<AuthUser>({
      peekAccount: () => peekRateLimit(accountKey, ACCOUNT_MAX_FAILURES, ACCOUNT_WINDOW_MS),
      chargeAccount: async () => {
        await checkRateLimit(accountKey, ACCOUNT_MAX_FAILURES, ACCOUNT_WINDOW_MS);
      },
      clearAccount: () => clearRateLimit(accountKey),
      verify: async () => {
        const user = await lookupUser(email);
        /* Timing-safe credential check: exactly one bcrypt comparison runs
           whether or not the account exists, so response time can't be used to
           enumerate registered emails. Rejected/pending approvals, a wrong
           password, and an unknown email all land on the same 401 below. */
        const isValid = await verifyLoginPassword(
          password,
          user?.password ?? null,
          bcrypt.compare,
        );
        return { ok: Boolean(user) && isValid, value: user };
      },
    });

    if (attempt.kind === "rate-limited") {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }
    if (attempt.kind !== "ok") {
      return NextResponse.json({ error: LOGIN_FAILURE_MESSAGE }, { status: 401 });
    }
    const user = attempt.value;

    const sections = user.userSections.map((us) => us.section);
    const primarySection = sections[0] || "MANAGEMENT";

    await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      section: primarySection,
      sv: user.sessionVersion,
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
