// GET /api/admin/approvals — List pending approval requests
// PUT /api/admin/approvals — Approve or reject a signup request

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notify";
import { getDefaultPfp } from "@/lib/utils";


export async function GET() {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approvals = await prisma.approval.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ approvals });
}

export async function PUT(req: Request) {
  const payload = await verifyToken();
  if (!payload || payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await req.json();

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const approval = await prisma.approval.findUnique({ where: { id } }) as {
    id: string;
    name: string;
    email: string;
    password: string;
    section: string;
    pfp: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  if (!approval || approval.status !== "PENDING") {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (action === "approve") {
    /* Create the user account */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await prisma.$transaction(async (tx: any) => {
      const pfp = approval.pfp || getDefaultPfp(approval.section);
      const newUser = await tx.user.create({
        data: {
          name: approval.name,
          email: approval.email,
          password: approval.password,
          role: "MEMBER",
          pfp,
        },
      });

      await tx.userSection.create({
        data: { userId: newUser.id, section: approval.section },
      });

      await tx.approval.update({
        where: { id },
        data: { status: "APPROVED" },
      });

      return newUser;
    });

    /* Notify the new member */
    await notify({
      userId: user.id,
      type: "MEMBER_JOINED",
      title: "Welcome to Catarina!",
      message: `Your account has been approved. You've been added to the ${approval.section} section.`,
    });

    /* Notify admins about the new member */
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      await notify({
        userId: admin.id,
        type: "MEMBER_JOINED",
        title: "New member joined",
        message: `${approval.name} has been approved and joined the ${approval.section} section.`,
        refId: user.id,
        refType: "user",
      });
    }

    return NextResponse.json({ user, message: "User approved and created" });
  } else {
    /* Reject */
    await prisma.approval.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    /* Notify admins about the rejection */
    await notifyAdmins({
      type: "SIGNUP_REJECTED",
      title: "Signup request rejected",
      message: `The signup request from ${approval.name} (${approval.email}) has been rejected.`,
      refId: approval.id,
      refType: "approval",
    });

    return NextResponse.json({ message: "Request rejected" });
  }
}
