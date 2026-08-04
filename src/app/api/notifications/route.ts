// GET /api/notifications — List notifications for the current user
// PATCH /api/notifications — Mark as read, pin/unpin
// DELETE /api/notifications — Delete a notification or clear all read

import { NextResponse } from "next/server";
import { requireUser, asBoolean, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const sinceRaw = searchParams.get("since");
  if (sinceRaw && Number.isNaN(Date.parse(sinceRaw))) {
    return jsonError("Invalid 'since' parameter", 400);
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: auth.data.userId,
      ...(unreadOnly ? { read: false } : {}),
      ...(sinceRaw ? { createdAt: { gt: new Date(sinceRaw) } } : {}),
    },
    orderBy: [
      { pinned: "desc" },
      { createdAt: "desc" },
    ],
    take: sinceRaw ? 50 : 100,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: auth.data.userId, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { id, read, pinned, markAllRead } = body;

  if (markAllRead === true) {
    await prisma.notification.updateMany({
      where: { userId: auth.data.userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return jsonError("Missing notification id", 400);
  }

  const data: Record<string, boolean> = {};
  if (read !== undefined) {
    const v = asBoolean(read);
    if (v === null) return jsonError("Invalid read value", 400);
    data.read = v;
  }
  if (pinned !== undefined) {
    const v = asBoolean(pinned);
    if (v === null) return jsonError("Invalid pinned value", 400);
    data.pinned = v;
  }

  const notification = await prisma.notification.update({
    where: { id, userId: auth.data.userId },
    data,
  });

  return NextResponse.json({ notification });
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { id, clearRead } = body;

  if (clearRead === true) {
    await prisma.notification.deleteMany({
      where: { userId: auth.data.userId, read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return jsonError("Missing notification id", 400);
  }

  await prisma.notification.delete({
    where: { id, userId: auth.data.userId },
  });

  return NextResponse.json({ ok: true });
}
