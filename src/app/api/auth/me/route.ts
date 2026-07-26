// GET /api/auth/me — Return the currently authenticated user
// Returns 401 if no valid token is present

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";
import changelog from "@/lib/changelog.json";

/* Compare semver strings — returns 1 if a > b, -1 if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/* Determine update category from semver diff */
function classifyUpdate(oldV: string, newV: string): "major" | "minor" | "patch" | "none" {
  const [oMaj, oMin] = oldV.split(".").map(Number);
  const [nMaj, nMin] = newV.split(".").map(Number);
  if (nMaj > oMaj) return "major";
  if (nMin > oMin) return "minor";
  return "patch";
}

export async function GET() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  /* Read current version from package.json */
  const pkg = await import("../../../../../package.json");
  const currentVersion: string = pkg.version;

  /* Fetch fresh user data with sections */
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      pfp: true,
      bio: true,
      primarySection: true,
      permissions: true,
      welcomeSeen: true,
      lastSeenVersion: true,
      userSections: { select: { section: true } },
    },
  }) as {
    id: string;
    name: string;
    email: string;
    role: string;
    pfp: string | null;
    bio: string | null;
    primarySection: string | null;
    permissions: string;
    welcomeSeen: boolean;
    lastSeenVersion: string;
    userSections: { section: string }[];
  } | null;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  /* Ensure every user has the hardcoded welcome notification */
  const hasWelcome = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      title: "Why Catarina? 🌸",
    },
  });

  if (hasWelcome) {
    if (hasWelcome.message !== "هو كده يكتفمك") {
      await prisma.notification.update({
        where: { id: hasWelcome.id },
        data: {
          message: "هو كده يكتفمك",
          pinned: true,
          refType: "audio",
          refId: "/media/fun.mp3",
        },
      });
    }
  } else {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "Why Catarina? 🌸",
        message: "هو كده يكتفمك",
        pinned: true,
        refType: "audio",
        refId: "/media/fun.mp3",
      },
    });
  }

  /* ─── Version update check ────────────────────────────────────────────── */
  let hasUpdate = false;
  let updateVersion: string | undefined;
  let updateType: "major" | "minor" | "patch" | undefined;
  let updateTitle: string | undefined;
  let updateEntries: { icon: string; text: string }[] | undefined;

  if (compareVersions(currentVersion, user.lastSeenVersion) > 0) {
    const detected = classifyUpdate(user.lastSeenVersion, currentVersion);
    const entry = (changelog as Record<string, { type: string; title: string; entries: { icon: string; text: string }[] }>)[currentVersion];

    hasUpdate = true;
    updateVersion = currentVersion;
    updateType = entry?.type as "major" | "minor" | "patch" || detected;
    updateTitle = entry?.title || `Catarina updated to v${currentVersion}`;
    updateEntries = entry?.entries || [{ icon: "🎉", text: "Something new arrived!" }];

    /* Create VERSION_UPDATE notification if not already present for this version */
    const existing = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "VERSION_UPDATE",
        refId: currentVersion,
      },
    });

    if (!existing) {
      const preview = updateEntries.slice(0, 2).map((e) => `${e.icon} ${e.text}`).join(" · ");
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "VERSION_UPDATE",
          title: `Catarina updated to v${currentVersion}`,
          message: preview,
          refType: "update",
          refId: currentVersion,
        },
      });
    }
  }

  return NextResponse.json({
    user: {
      ...user,
      sections: user.userSections.map((us) => us.section),
      userSections: undefined,
      lastSeenVersion: undefined,
      permissions: user.role === "ADMIN" ? { canCreateGoals: true, canEditGoals: true, canDeleteGoals: true, canManageMembers: true, canCreateMonths: true } : parsePermissions(user.permissions),
    },
    hasUpdate,
    ...(hasUpdate && { updateVersion, updateType, updateTitle, updateEntries }),
  });
}
