// POST /api/auth/register — Request a new account (creates pending approval)
// Account is NOT active until an admin approves it in the admin panel

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SECTIONS } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password, section } = await req.json();

    if (!name || !email || !password || !section) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!SECTIONS.includes(section)) {
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

    const hashedPassword = await bcrypt.hash(password, 12);

    /* Create or update the approval request */
    const approval = await prisma.approval.upsert({
      where: { email },
      update: {
        name,
        password: hashedPassword,
        section,
        status: "PENDING",
      },
      create: {
        name,
        email,
        password: hashedPassword,
        section,
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
