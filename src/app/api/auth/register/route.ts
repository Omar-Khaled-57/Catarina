// POST /api/auth/register — Request a new account (creates pending approval)
// Account is NOT active until an admin approves it in the admin panel

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SECTIONS } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import bcrypt from "bcryptjs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
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

    if (!SECTIONS.includes(section as typeof SECTIONS[number])) {
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

    let pfpPath: string | null = null;
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
      if (pfp.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large. Max 5 MB." },
          { status: 400 }
        );
      }
      const ext = pfp.name.split(".").pop() || "jpg";
      const filename = `register-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      const filepath = path.join(uploadDir, filename);
      await mkdir(uploadDir, { recursive: true });
      const bytes = Buffer.from(await pfp.arrayBuffer());
      await writeFile(filepath, bytes);
      pfpPath = `/uploads/${filename}`;
    }

    const hashedPassword = await bcrypt.hash(password as string, 12);

    /* Create or update the approval request */
    const approval = await prisma.approval.upsert({
      where: { email },
      update: {
        name: name as string,
        password: hashedPassword,
        section: section as string,
        pfp: pfpPath,
        status: "PENDING",
      },
      create: {
        name: name as string,
        email: email as string,
        password: hashedPassword,
        section: section as string,
        pfp: pfpPath,
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
