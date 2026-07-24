/**
 * Shared Permissions Types & Helpers — Granular per-member permissions
 * controlled by admin. Defines permission flags, defaults, and serialization.
 */

/**
 * Permission flags for a member.
 * Stored as JSON string in User.permissions.
 * Admin always has all permissions regardless of these flags.
 */
export interface MemberPermissions {
  /** Can create new goals in assigned sections */
  canCreateGoals: boolean;
  /** Can edit goal details (current, target, name, description) */
  canEditGoals: boolean;
  /** Can delete goals */
  canDeleteGoals: boolean;
  /** Can manage member accounts (promote, edit, etc.) */
  canManageMembers: boolean;
  /** Can create new planning months */
  canCreateMonths: boolean;
}

/** Default permissions for a new MEMBER (conservative) */
export const DEFAULT_PERMISSIONS: MemberPermissions = {
  canCreateGoals: true,
  canEditGoals: false,
  canDeleteGoals: false,
  canManageMembers: false,
  canCreateMonths: false,
};

/** Admin gets everything — this is the canonical full set */
export const ADMIN_PERMISSIONS: MemberPermissions = {
  canCreateGoals: true,
  canEditGoals: true,
  canDeleteGoals: true,
  canManageMembers: true,
  canCreateMonths: true,
};

/**
 * Parse permissions JSON string from DB into a MemberPermissions object.
 * Falls back to defaults if the JSON is invalid or missing fields.
 */
export function parsePermissions(raw: string | null | undefined): MemberPermissions {
  try {
    const parsed = JSON.parse(raw || "{}");
    return { ...DEFAULT_PERMISSIONS, ...parsed };
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

/**
 * Serialize permissions object to JSON string for DB storage.
 */
export function serializePermissions(perms: MemberPermissions): string {
  return JSON.stringify(perms);
}

/** Display labels for each permission flag */
export const PERMISSION_LABELS: Record<keyof MemberPermissions, string> = {
  canCreateGoals: "Create Goals",
  canEditGoals: "Edit Goals",
  canDeleteGoals: "Delete Goals",
  canManageMembers: "Manage Members",
  canCreateMonths: "Create Months",
};
