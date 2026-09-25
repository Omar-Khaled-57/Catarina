/**
 * Proxy — Edge auth + CSRF protection.
 *
 * Two jobs, one file, running at the edge in front of everything:
 *
 *  1. Auth guard (dashboard / tools): verifies the HttpOnly JWT cookie and
 *     redirects to login when missing/invalid.
 *  2. Same-origin guard (/api/*): for every mutating /api request (POST, PUT,
 *     PATCH, DELETE), require the browser's Origin (with Referer as a fallback
 *     for older browsers / cookie-less clients) to match the request host.
 *     Cross-origin mutating calls answer 403 before they reach the handler.
 *     The decision itself lives in @/lib/originGuard so it can be unit-tested;
 *     in particular it fails CLOSED on an Origin that was sent but is opaque
 *     (`Origin: null`, e.g. a sandboxed iframe) or malformed.
 *
 * Why this lives at the edge instead of in each route:
 *  - One place to enforce the invariant for ALL current and future routes —
 *    "wire it into every mutating route" can't silently miss tomorrow's.
 *  - Next's route handlers can't read the CSP/secure-headers posture from the
 *    next.config headers, but the edge proxy owns the full request and can
 *    fail closed before a single handler runs.
 *
 * CSRF model: the session cookie is SameSite=Lax + HttpOnly so top-level
 * navigations stay usable while cross-site mutating requests drop the cookie.
 * The origin check here is the second, independent layer — even where SameSite
 * wouldn't apply (old browsers, cookie-less clients), a foreign Origin can't
 * mutate state because the edge rejects it first.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isSameOrigin } from "@/lib/originGuard";

const COOKIE_NAME = "catarina-token";
const SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

if (!SECRET) {
  console.error("[proxy] JWT_SECRET env var is missing — dashboard routes will redirect to login");
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const token = request.cookies.get(COOKIE_NAME)?.value;

  /* ── Same-origin guard: mutating /api from a foreign Origin → 403 ── */
  if (
    isApi &&
    MUTATING_METHODS.has(request.method) &&
    !isSameOrigin({
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      host: request.headers.get("host"),
    })
  ) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed" },
      { status: 403 }
    );
  }

  /* ── Auth guard: dashboard / tools only (API routes validate themselves) ── */
  if (!isApi) {
    if (!token || !SECRET) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    try {
      await jwtVerify(token, SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/tools/:path*", "/api/:path*"],
};
