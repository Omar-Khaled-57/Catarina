// GET /api/drive/auth-url — Start Google Drive OAuth (authenticated users only)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { buildDriveAuthUrl, isDriveEnabled } from "@/lib/drive";

const STATE_COOKIE = "drive-oauth-state";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isDriveEnabled()) {
    return jsonError("Google Drive is not configured on this server", 400);
  }

  /* CSRF state: only the server that issued it knows this value, and the
     callback verifies it before exchanging the code. */
  const state = randomBytes(24).toString("hex");
  const url = buildDriveAuthUrl(state);
  if (!url) return jsonError("Google Drive is not configured on this server", 400);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.json({ url });
}