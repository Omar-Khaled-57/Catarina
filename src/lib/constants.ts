/**
 * Shared Application Constants — single source of truth for roles,
 * notification types, cookie name, and permission keys.
 */

/** User roles */
export const ROLE_ADMIN = "ADMIN";
export const ROLE_MEMBER = "MEMBER";

/** Auth cookie name (HttpOnly) */
export const COOKIE_NAME = "catarina-token";

/** Notification types */
export const NOTIFICATION_TYPES = {
  GOAL_CREATED: "GOAL_CREATED",
  STEP_ADDED: "STEP_ADDED",
  MEMBER_JOINED: "MEMBER_JOINED",
  SIGNUP_REQUEST: "SIGNUP_REQUEST",
  SIGNUP_REJECTED: "SIGNUP_REJECTED",
  DEADLINE_APPROACHING: "DEADLINE_APPROACHING",
  DEADLINE_MISSED: "DEADLINE_MISSED",
  GOAL_COMPLETED: "GOAL_COMPLETED",
  SYSTEM: "SYSTEM",
  GOAL_REACHED: "GOAL_REACHED",
  COMMENT_ADDED: "COMMENT_ADDED",
  MEMBER_LEFT_SECTION: "MEMBER_LEFT_SECTION",
  MEMBER_DELETED: "MEMBER_DELETED",
  MONTH_CREATED: "MONTH_CREATED",
  GOALS_CARRIED_OVER: "GOALS_CARRIED_OVER",
  ROLE_CHANGED: "ROLE_CHANGED",
  VERSION_UPDATE: "VERSION_UPDATE",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/** Permission flag keys (must match MemberPermissions in lib/permissions) */
export const PERMISSION_KEYS = [
  "canCreateGoals",
  "canEditGoals",
  "canDeleteGoals",
  "canManageMembers",
  "canCreateMonths",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
