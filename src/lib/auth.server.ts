/**
 * Server-only Authentication Helpers — JWT token creation/verification
 * using jose, with HttpOnly cookies for XSS protection.
 * This file must ONLY be imported in Server Components or API routes.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/** JWT payload structure stored in the token */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  section: string;
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = "catarina-token";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Creates a signed JWT token and sets it as an HttpOnly cookie.
 * Tokens are not accessible via JavaScript (XSS protection).
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });

  return token;
}

/**
 * Verifies the JWT token from cookies and returns the decoded payload.
 * Returns null if the token is missing, expired, or invalid.
 */
export async function verifyToken(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Removes the auth cookie (used for logout).
 */
export async function removeToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
