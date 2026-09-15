/**
 * Table-specific permission helpers.
 *
 * Mirrors the drawer permission pattern: pure, testable, backed by the
 * `canManageTables` JSON flag + ADMIN bypass + section membership.
 */

import { ROLE_ADMIN } from "@/lib/constants";
import type { MemberPermissions } from "@/lib/permissions";

export interface TableCtx {
  role: string;
  sections: string[];
  permissions: MemberPermissions;
}

interface TableLike {
  section: string;
}

/** Every authenticated user can read any table in their sections. */
export function canReadTable(ctx: TableCtx, table: TableLike): boolean {
  return (
    ctx.role === ROLE_ADMIN || ctx.sections.includes(table.section.toUpperCase())
  );
}

/**
 * Write access: ADMIN always, or canManageTables flag + section membership.
 */
export function canWriteTable(ctx: TableCtx, table: TableLike): boolean {
  if (ctx.role === ROLE_ADMIN) return true;
  if (!ctx.permissions.canManageTables) return false;
  return ctx.sections.includes(table.section.toUpperCase());
}

/**
 * Sticker management mirrors write access (team decorations).
 */
export function canManageStickers(ctx: TableCtx, table: TableLike): boolean {
  return canWriteTable(ctx, table);
}
