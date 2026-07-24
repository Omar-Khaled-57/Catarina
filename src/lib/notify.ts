// Notification helper — create notifications for various app events

import { prisma } from "@/lib/prisma";

type NotificationType =
  | "GOAL_CREATED"
  | "STEP_ADDED"
  | "MEMBER_JOINED"
  | "SIGNUP_REQUEST"
  | "SIGNUP_REJECTED"
  | "DEADLINE_APPROACHING"
  | "DEADLINE_MISSED"
  | "GOAL_COMPLETED"
  | "SYSTEM"
  | "GOAL_REACHED"
  | "COMMENT_ADDED"
  | "MEMBER_LEFT_SECTION"
  | "MEMBER_DELETED"
  | "MONTH_CREATED"
  | "GOALS_CARRIED_OVER"
  | "ROLE_CHANGED";

/**
 * Create a notification for a single user.
 */
export async function notify(opts: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  refId?: string;
  refType?: string;
}) {
  return prisma.notification.create({ data: opts });
}

/**
 * Notify multiple users at once.
 */
export async function notifyMany(
  userIds: string[],
  opts: Omit<Parameters<typeof notify>[0], "userId">
) {
  if (userIds.length === 0) return;
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({ ...opts, userId })),
  });
}

/**
 * Notify all admins.
 */
export async function notifyAdmins(
  opts: Omit<Parameters<typeof notify>[0], "userId">
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  }) as Array<{ id: string }>;
  return notifyMany(admins.map((a) => a.id), opts);
}

/**
 * Notify all members of a specific section.
 */
export async function notifySection(
  section: string,
  opts: Omit<Parameters<typeof notify>[0], "userId">
) {
  const members = await prisma.userSection.findMany({
    where: { section },
    select: { userId: true },
  }) as Array<{ userId: string }>;
  return notifyMany(
    [...new Set(members.map((m) => m.userId))],
    opts
  );
}
