/* Returns 200 with { user: null } when signed out — keeps unauthenticated
   browsers free of console 401 noise (Lighthouse "browser errors" audit).
   Clients treat user:null the same as a 401. */

import { after, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { buildAuthUser } from "@/lib/auth-session";
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

async function maintainWelcomeNotification(userId: string): Promise<void> {
  try {
    const welcome = await prisma.notification.findFirst({
      where: { userId, title: "Why Catarina? 🌸" },
    });
    if (welcome) {
      if (welcome.message !== "هو كده يكتفمك") {
        await prisma.notification.update({
          where: { id: welcome.id },
          data: {
            message: "هو كده يكتفمك",
            pinned: true,
            refType: "audio",
            refId: "/media/fun.mp3",
          },
        });
      }
      return;
    }
    await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "Why Catarina? 🌸",
        message: "هو كده يكتفمك",
        pinned: true,
        refType: "audio",
        refId: "/media/fun.mp3",
      },
    });
  } catch (error) {
    console.error("[AUTH_ME] welcome notification maintenance failed:", error);
  }
}

async function maintainVersionNotification(
  userId: string,
  version: string,
  entries: { icon: string; text: string }[],
): Promise<void> {
  try {
    const existing = await prisma.notification.findFirst({
      where: { userId, type: "VERSION_UPDATE", refId: version },
    });
    if (existing) return;

    const preview = entries.slice(0, 2).map((entry) => `${entry.icon} ${entry.text}`).join("\n");
    await prisma.notification.create({
      data: {
        userId,
        type: "VERSION_UPDATE",
        title: `Catarina updated to v${version}`,
        message: preview,
        refType: "update",
        refId: version,
      },
    });
  } catch (error) {
    console.error("[AUTH_ME] version notification maintenance failed:", error);
  }
}

export async function GET() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ user: null, hasUpdate: false });
  }

  /* Read current version from package.json */
  const pkg = await import("../../../../../package.json");
  const currentVersion: string = pkg.version;

  /* Fetch fresh user data with sections */
  let user: {
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
  try {
    user = await prisma.user.findUnique({
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
    });
  } catch (error) {
    console.error("[AUTH_ME] user lookup failed:", error);
    return NextResponse.json(
      { error: "Authentication status is temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "2" } },
    );
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  }

  /* Notification maintenance is not required to hydrate auth state. Schedule
     it after the response so Turso retries/timeouts cannot hold up navigation. */
  after(async () => {
    const jobs = [maintainWelcomeNotification(user.id)];
    if (hasUpdate && updateEntries) {
      jobs.push(maintainVersionNotification(user.id, currentVersion, updateEntries));
    }
    await Promise.all(jobs);
  });

  return NextResponse.json({
    user: buildAuthUser(user),
    hasUpdate,
    ...(hasUpdate && { updateVersion, updateType, updateTitle, updateEntries }),
  });
}
