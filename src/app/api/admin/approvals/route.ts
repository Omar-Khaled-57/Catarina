// GET /api/admin/approvals — List pending approval requests
// PUT /api/admin/approvals — Approve or reject a signup request

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notify";
import { getDefaultPfp } from "@/lib/utils";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const approvals = await prisma.approval.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ approvals });
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request", 400);
  }

  const { id, action } = body;
  if (!id || !["approve", "reject"].includes(action)) {
    return jsonError("Invalid request", 400);
  }

  const approval = await prisma.approval.findUnique({ where: { id } });
  if (!approval || approval.status !== "PENDING") {
    return jsonError("Approval not found", 404);
  }

  if (action === "approve") {
    /* Create the user account */
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
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
          data: { userId: newUser.id, section: approval.section.toUpperCase() },
        });

        await tx.approval.update({
          where: { id },
          data: { status: "APPROVED" },
        });

        return newUser;
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return jsonError("A user with this email already exists", 409);
      }
      console.error("[APPROVALS_APPROVE]", error);
      return jsonError("Internal server error", 500);
    }

    /* Notify the new member */
    await notify({
      userId: user.id,
      type: "MEMBER_JOINED",
      title: "Welcome to Catarina!",
      message: `Your account has been approved. You've been added to the ${approval.section} section.`,
    });

    /* Notify admins about the new member */
    await notifyAdmins({
      type: "MEMBER_JOINED",
      title: "New member joined",
      message: `${approval.name} has been approved and joined the ${approval.section} section.`,
      refId: user.id,
      refType: "user",
    });

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
