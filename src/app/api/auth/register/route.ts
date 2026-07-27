// POST /api/auth/register — Request a new account (creates pending approval)
// Account is NOT active until an admin approves it in the admin panel
// Rate limited: 3 attempts per 5 minutes per IP

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSectionKeys } from "@/lib/sections";
import { notifyAdmins } from "@/lib/notify";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    /* Rate limit: 3 registration attempts per 5 minutes */
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`register:${ip}`, 3, 5 * 60_000);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const section = formData.get("section") as string;
    const pfp = formData.get("pfp") as File | null;

    if (!name || !email || !password || !section) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const validSections = await getSectionKeys();
    if (!validSections.includes(section.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid section" },
        { status: 400 }
      );
    }

    /* Check if email is already registered as a user */
    const existingUser = await prisma.user.findUnique({ where: { email } }) as {
      id: string;
      email: string;
      name: string;
      role: string;
      password: string;
      pfp: string | null;
      bio: string | null;
      primarySection: string | null;
      permissions: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    /* Check if there's already a pending approval for this email */
    const existingApproval = await prisma.approval.findUnique({
      where: { email },
    }) as {
      id: string;
      email: string;
      name: string;
      password: string;
      section: string;
      pfp: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    if (existingApproval && existingApproval.status === "PENDING") {
      return NextResponse.json(
        { error: "A request for this email is already pending approval" },
        { status: 409 }
      );
    }

    let pfpDataUri: string | null = null;
    if (pfp && pfp.size > 0) {
      const ALLOWED_TYPES = new Set([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ]);
      if (!ALLOWED_TYPES.has(pfp.type)) {
        return NextResponse.json(
          { error: "Unsupported file type. Use JPG, PNG, GIF, or WebP." },
          { status: 400 }
        );
      }
      if (pfp.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large. Max 2 MB." },
          { status: 400 }
        );
      }
      const bytes = await pfp.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      pfpDataUri = `data:${pfp.type};base64,${base64}`;
    }

    const hashedPassword = await bcrypt.hash(password as string, 12);

    /* Create or update the approval request */
    const approval = await prisma.approval.upsert({
      where: { email },
      update: {
        name: name as string,
        password: hashedPassword,
        section: section as string,
        pfp: pfpDataUri,
        status: "PENDING",
      },
      create: {
        name: name as string,
        email: email as string,
        password: hashedPassword,
        section: section as string,
        pfp: pfpDataUri,
      },
    });

    /* Notify all admins about the new signup request */
    await notifyAdmins({
      type: "SIGNUP_REQUEST",
      title: "New signup request",
      message: `${name} (${email}) wants to join the ${section} section.`,
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
