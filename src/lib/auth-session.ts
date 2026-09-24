/**
 * Server-only session helpers — builds the client-user shape shared by the
 * login, me, and refresh routes so all three return an identical user object.
 * Must ONLY be imported in Server Components or route handlers.
 */

import { resolvePermissions } from "@/lib/permissions";

/** The user object returned to the client (matches src/contexts/AuthContext). */
export interface AuthUserClient {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  primarySection: string | null;
  welcomeSeen: boolean;
  permissions: ReturnType<typeof resolvePermissions>;
  sections: string[];
}

interface AuthUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  primarySection: string | null;
  welcomeSeen: boolean;
  permissions: string;
  userSections: { section: string }[];
}

/** Map a Prisma user row (with userSections) to the client user object. */
export function buildAuthUser(user: AuthUserRow): AuthUserClient {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    pfp: user.pfp,
    bio: user.bio,
    primarySection: user.primarySection,
    welcomeSeen: user.welcomeSeen,
    permissions: resolvePermissions(user.role, user.permissions),
    sections: user.userSections.map((us) => us.section),
  };
}