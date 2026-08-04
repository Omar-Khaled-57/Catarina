// Notification helper — create notifications for various app events

import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN, type NotificationType } from "@/lib/constants";

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
    where: { role: ROLE_ADMIN },
    select: { id: true },
  });
  return notifyMany(admins.map((a) => a.id), opts);
}

/**
 * Notify all members of a specific section (optionally excluding one user,
 * e.g. the actor who triggered the event).
 */
export async function notifySection(
  section: string,
  opts: Omit<Parameters<typeof notify>[0], "userId">,
  excludeUserId?: string
) {
  const members = await prisma.userSection.findMany({
    where: { section },
    select: { userId: true },
  });
  return notifyMany(
    [...new Set(members.map((m) => m.userId))].filter(
      (uid) => uid !== excludeUserId
    ),
    opts
  );
}
