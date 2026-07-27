/**
 * Middleware — Auth protection for dashboard routes.
 * Verifies JWT token from cookies and redirects to login if missing/invalid.
 * Runs on the edge for fast response times.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "catarina-token";
const SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

if (!SECRET) {
  console.error("[middleware] JWT_SECRET env var is missing — dashboard routes will redirect to login");
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!SECRET) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
