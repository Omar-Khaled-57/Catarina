// POST /api/auth/logout — Revoke the device's refresh token (if provided) and
// clear the session cookie. Revocation is essential: without it, the client's
// localStorage token would silently log the user back in on the next visit.

import { NextResponse } from "next/server";
import { removeToken, verifyToken } from "@/lib/auth.server";
import { revokeRefreshToken } from "@/lib/refreshToken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ipRateLimitKey, scaleForSharedBucket } from "@/lib/rateLimitPolicy";

export async function POST(req: Request) {
  try {
    /* Rate limit: 10 logouts per minute per IP — parity with login and refresh
     * (10/min). Without it this route is a cheap place to grind revocation
     * writes (and it exposes the same localStorage-token state machine as
     * refresh, so it should be throttled the same way). */
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(
      ipRateLimitKey("logout", ip),
      scaleForSharedBucket(10, ip),
      60_000,
    );
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    /* Revocation is scoped to the caller: revoking a family signs out every
       device signed in through it, so it must never run on a token the caller
       cannot prove they own. `verifyToken` only reads the cookie (no DB hit),
       and the actual ownership check happens against the token row inside
       `revokeRefreshToken`. An expired/absent cookie still clears the cookie
       below — logout is never blocked by a stale session. */
    const payload = await verifyToken();
    const body = await req.json().catch(() => ({}));
    if (body?.refreshToken && payload?.userId) {
      await revokeRefreshToken(body.refreshToken, payload.userId);
    }
  } catch {
    /* Revocation is best-effort; the cookie is cleared regardless. */
  }
  await removeToken();
  return NextResponse.json({ success: true });
}
