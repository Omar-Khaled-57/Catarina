// GET /api/notifications — List notifications for the current user
// PATCH /api/notifications — Mark as read, pin/unpin
// DELETE /api/notifications — Delete a notification or clear all read

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: payload.userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: [
      { pinned: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
  }) as Array<{
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    pinned: boolean;
    refType: string | null;
    refId: string | null;
    createdAt: Date;
  }>;

  const unreadCount = await prisma.notification.count({
    where: { userId: payload.userId, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, read, pinned, markAllRead } = await req.json();

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: payload.userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  const data: Record<string, boolean> = {};
  if (read !== undefined) data.read = read;
  if (pinned !== undefined) data.pinned = pinned;

  const notification = await prisma.notification.update({
    where: { id, userId: payload.userId },
    data,
  });

  return NextResponse.json({ notification });
}

export async function DELETE(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, clearRead } = await req.json();

  if (clearRead) {
    await prisma.notification.deleteMany({
      where: { userId: payload.userId, read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  await prisma.notification.delete({
    where: { id, userId: payload.userId },
  });

  return NextResponse.json({ ok: true });
}
