// POST /api/auth/logout — Revoke the device's refresh token (if provided) and
// clear the session cookie. Revocation is essential: without it, the client's
// localStorage token would silently log the user back in on the next visit.

import { NextResponse } from "next/server";
import { removeToken } from "@/lib/auth.server";
import { revokeRefreshToken } from "@/lib/refreshToken";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }
  } catch {
    /* Revocation is best-effort; the cookie is cleared regardless. */
  }
  await removeToken();
  return NextResponse.json({ success: true });
}