// POST /api/auth/logout — Revoke the device's refresh token (if provided) and
// clear the session cookie. Revocation is essential: without it, the client's
// localStorage token would silently log the user back in on the next visit.

import { NextResponse } from "next/server";
import { removeToken } from "@/lib/auth.server";
import { revokeRefreshToken } from "@/lib/refreshToken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ipRateLimitKey } from "@/lib/rateLimitPolicy";

export async function POST(req: Request) {
  try {
    /* Rate limit: 10 logouts per minute per IP — parity with login and refresh
     * (10/min). Without it this route is a cheap place to grind revocation
     * writes (and it exposes the same localStorage-token state machine as
     * refresh, so it should be throttled the same way). */
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ipRateLimitKey("logout", ip), 10, 60_000);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

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
