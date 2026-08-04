/**
 * Server-only API helpers — consistent auth, error responses, and input
 * validation for route handlers. Keeps auth/permission/validation logic in
 * one place instead of being re-implemented in every route.
 */

import { NextResponse } from "next/server";
import { verifyToken, type JWTPayload } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import { parsePermissions, type MemberPermissions } from "@/lib/permissions";
import { ROLE_ADMIN, ROLE_MEMBER } from "@/lib/constants";

/* ─── Error responses ─────────────────────────────────────────────────────── */

/** Consistent error response shape used across all routes */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/* ─── Auth helpers ────────────────────────────────────────────────────────── */

type AuthResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Require an authenticated user. Returns the JWT payload or a 401 response.
 * Usage: `const auth = await requireUser(); if (!auth.ok) return auth.response;`
 */
export async function requireUser(): Promise<AuthResult<JWTPayload>> {
  const payload = await verifyToken();
  if (!payload) return { ok: false, response: jsonError("Unauthorized", 401) };
  return { ok: true, data: payload };
}

/**
 * Require an authenticated admin. Returns the JWT payload or a 403 response.
 * Re-reads the role from the DB so demoted admins lose access immediately
 * instead of keeping JWT-snapshot privileges for the token's lifetime.
 */
export async function requireAdmin(): Promise<AuthResult<JWTPayload>> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const ctx = await getUserContext(auth.data.userId);
  if (ctx.role !== ROLE_ADMIN) {
    return { ok: false, response: jsonError("Admin access required", 403) };
  }
  return auth;
}

/* ─── User context ────────────────────────────────────────────────────────── */

export interface UserContext {
  id: string;
  role: string;
  sections: string[];
  permissions: MemberPermissions;
}

/**
 * Load a user's live section memberships and permissions from the DB.
 * Unlike the JWT's snapshot `section` claim, this is always current.
 */
export async function getUserContext(userId: string): Promise<UserContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userSections: { select: { section: true } } },
  });
  return {
    id: userId,
    role: user?.role ?? ROLE_MEMBER,
    sections: user?.userSections.map((s) => s.section) ?? [],
    permissions: parsePermissions(user?.permissions),
  };
}

/**
 * Resolve a goal and verify the user can access it (admin bypasses section
 * checks). Returns the goal or a 403/404 response.
 */
export async function requireGoalAccess(
  userId: string,
  role: string,
  goalId: string
): Promise<{ ok: true; goal: GoalWithSection } | { ok: false; response: NextResponse }> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, section: true },
  });
  if (!goal) return { ok: false, response: jsonError("Goal not found", 404) };

  if (role !== ROLE_ADMIN) {
    const ctx = await getUserContext(userId);
    if (!ctx.sections.includes(goal.section)) {
      return { ok: false, response: jsonError("Forbidden", 403) };
    }
  }
  return { ok: true, goal };
}

type GoalWithSection = { id: string; section: string };

/* ─── Input validation helpers ────────────────────────────────────────────── */

/** Trimmed non-empty string within max length, or null */
export function asString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Integer >= 0, or null */
export function asNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/** Integer >= 1, or null */
export function asPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/** Strict boolean, or null */
export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Valid Date parsed from ISO string, or null */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface GoalFields {
  name?: string;
  description?: string;
  current?: number;
  target?: number;
  deadline?: Date;
}

/**
 * Validate optional goal fields from a request body.
 * Returns sanitized fields or a reject message (single source for
 * POST /api/goals and PUT /api/goals/[id]).
 */
export function validateGoalFields(
  body: Record<string, unknown>
): { ok: true; data: GoalFields } | { ok: false; message: string } {
  const data: GoalFields = {};

  if (body.name !== undefined) {
    const name = asString(body.name, 200);
    if (!name) return { ok: false, message: "Invalid goal name" };
    data.name = name;
  }

  if (body.description !== undefined) {
    const description = asString(body.description, 5000);
    if (!description) return { ok: false, message: "Invalid description" };
    data.description = description;
  }

  if (body.current !== undefined) {
    const current = asNonNegativeInt(body.current);
    if (current === null) return { ok: false, message: "Invalid current value" };
    data.current = current;
  }

  if (body.target !== undefined) {
    const target = asPositiveInt(body.target);
    if (target === null) return { ok: false, message: "Invalid target value" };
    data.target = target;
  }

  if (body.deadline !== undefined) {
    const deadline = parseDate(body.deadline);
    if (!deadline) return { ok: false, message: "Invalid deadline" };
    data.deadline = deadline;
  }

  return { ok: true, data };
}
