// POST /api/auth/register — Request a new account (creates pending approval)
// Account is NOT active until an admin approves it in the admin panel
// Rate limited: 3 attempts per 5 minutes per IP
//
// A signup may only CREATE an approval row. An existing request — pending or
// stale — blocks the email until an admin clears it; see @/lib/registrationPolicy
// for why rewriting one is an account-takeover path.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSectionKeys } from "@/lib/sections";
import { notifyAdmins } from "@/lib/notify";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { accountRateLimitKey, ipRateLimitKey } from "@/lib/rateLimitPolicy";
import { asValidPassword } from "@/lib/api-helpers";
import {
  REGISTRATION_CONFLICT_MESSAGE,
  decideRegistration,
} from "@/lib/registrationPolicy";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  sniffImageType,
} from "@/lib/image";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    /* Rate limit: 3 registration attempts per 5 minutes, per IP AND per email.
       The per-email layer is keyed on a hash, so one address can't be spammed
       with requests from a rotating set of forged IPs. */
    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(ipRateLimitKey("register", ip), 3, 5 * 60_000);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }
    const formData = await req.formData();
    const name = (formData.get("name") as string | null)?.trim() || "";
    const email = (formData.get("email") as string | null)?.trim() || "";
    const password = (formData.get("password") as string) || "";
    const section = (formData.get("section") as string | null)?.toUpperCase().trim() || "";
    const pfp = formData.get("pfp") as File | null;

    if (!name || !email || !password || !section) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    /* Per-email cap, mirroring login: bounded even when the IP is untrusted. */
    const emailLimit = await checkRateLimit(
      accountRateLimitKey("register", email),
      3,
      5 * 60_000,
    );
    if (emailLimit.limited) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Name is too long (max 100 characters)" }, { status: 400 });
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const pw = asValidPassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.message }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    const validSections = await getSectionKeys();
    if (!validSections.includes(section)) {
      return NextResponse.json(
        { error: "Invalid section" },
        { status: 400 }
      );
    }

    /* Single decision for every conflict (existing user, pending request, or a
       stale request an admin must clear) — one message, so this endpoint can't
       be used to enumerate accounts or probe approval state. Any pre-existing
       approval row blocks the request outright: rewriting one would let a
       stranger replace the stored name/password/section and be handed the
       identity by a routine admin approval. */
    const [existingUser, existingApproval] = await Promise.all([
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
      prisma.approval.findUnique({
        where: { email: normalizedEmail },
        select: { status: true },
      }),
    ]);

    const decision = decideRegistration({
      userExists: !!existingUser,
      approvalStatus: (existingApproval?.status ?? null) as
        | "PENDING"
        | "REJECTED"
        | "APPROVED"
        | null,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: REGISTRATION_CONFLICT_MESSAGE }, { status: 409 });
    }

    let pfpDataUri: string | null = null;
    if (pfp && pfp.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(pfp.type)) {
        return NextResponse.json(
          { error: "Unsupported file type. Use JPG, PNG, GIF, or WebP." },
          { status: 400 }
        );
      }
      if (pfp.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Max 2 MB." },
          { status: 400 }
        );
      }
      const bytes = new Uint8Array(await pfp.arrayBuffer());
      const detected = sniffImageType(bytes);
      if (!detected) {
        return NextResponse.json(
          { error: "File is not a valid image" },
          { status: 400 }
        );
      }
      const base64 = Buffer.from(bytes).toString("base64");
      pfpDataUri = `data:${detected};base64,${base64}`;
    }

    const hashedPassword = await bcrypt.hash(pw.password, 12);

    /* Create-only. An earlier version used an upsert whose `update:` branch
       rewrote name/password/section/pfp on an existing (REJECTED) request,
       which let an unauthenticated caller hijack a rejected applicant's
       identity through a later admin approval. The decision above guarantees no
       row exists, so create is the only correct write — and a concurrent race
       that slips a row in between is caught as a unique-constraint conflict
       below rather than overwriting it. */
    let approval;
    try {
      approval = await prisma.approval.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          section,
          pfp: pfpDataUri,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        /* Lost the race against a concurrent signup for the same email — answer
           exactly like every other conflict and never overwrite it. */
        return NextResponse.json({ error: REGISTRATION_CONFLICT_MESSAGE }, { status: 409 });
      }
      throw error;
    }

    /* Notify all admins about the new signup request */
    await notifyAdmins({
      type: "SIGNUP_REQUEST",
      title: "New signup request",
      message: `${name} (${normalizedEmail}) wants to join the ${section} section.`,
      refId: approval.id,
      refType: "approval",
    });

    return NextResponse.json({
      message: "Your account request has been submitted. An admin will review it shortly.",
    });
  } catch (error) {
    console.error("[REGISTER]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
