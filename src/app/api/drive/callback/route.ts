// GET /api/drive/callback — Google OAuth redirect target.
// Exchanges the code, stores the (encrypted) connection, provisions the shared
// "Catarina" root folder + section folders, then redirects back to the drawers.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/api-helpers";
import {
  exchangeDriveCode,
  saveDriveConnection,
  ensureRootFolder,
  DriveError,
} from "@/lib/drive";

const STATE_COOKIE = "drive-oauth-state";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.redirect(
      new URL("/tools/drawers?drive=unauthorized", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/tools/drawers?drive=error", request.url)
    );
  }

  try {
    const result = await exchangeDriveCode(code);
    await saveDriveConnection(auth.data.userId, result.googleEmail, result.tokens);

    const conn = {
      userId: auth.data.userId,
      googleEmail: result.googleEmail,
      tokens: result.tokens,
    };
    await ensureRootFolder(conn).catch(() => undefined);

    return NextResponse.redirect(
      new URL("/tools/drawers?drive=connected", request.url)
    );
  } catch (error) {
    console.error("Drive callback error:", error);
    const reason =
      error instanceof DriveError && error.status === 401 ? "expired" : "error";
    return NextResponse.redirect(
      new URL(`/tools/drawers?drive=${reason}`, request.url)
    );
  }
}