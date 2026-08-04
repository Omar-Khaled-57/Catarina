// Shared Application Types — single source of truth for data shapes
// Used across pages, components, and API routes

/** Goal data structure from the API — full version */
export interface GoalData {
  id: string;
  name: string;
  description: string;
  goalNumber: number;
  current: number;
  target: number;
  done: boolean;
  deadline: string;
  carriedOver: boolean;
  section: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  monthId: string;
  authorId: string;
  deadlineSetByAdmin: boolean;
  comments: { id: string }[];
  assignments: {
    userId: string;
    name: string;
    pfp: string | null;
    canCheck: boolean;
    canEdit: boolean;
  }[];
  steps: {
    id: string;
    text: string;
    done: boolean;
    order: number;
  }[];
}

/** Minimal goal data used in dashboard overview (no comments/assignments/steps) */
export type DashboardGoal = Pick<
  GoalData,
  | "id" | "name" | "description" | "current" | "target" | "done"
  | "deadline" | "carriedOver" | "section" | "updatedAt"
>;

/** Section data — minimal API response shape (key, label, color) */
export interface SectionData {
  key: string;
  label: string;
  color: string;
}

/** Full section data from DB — includes prefix and sort order */
export interface SectionDataFull extends SectionData {
  prefix: string;
  sortOrder: number;
  isActive: boolean;
}

/** User data shape from /api/auth/me */
export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  sections: string[];
  primarySection: string | null;
  permissions: {
    canEditGoals: boolean;
    canDeleteGoals: boolean;
    canCreateGoals: boolean;
    canManageMembers: boolean;
    canCreateMonths: boolean;
  };
}

/** Admin user list item */
export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  sections: string[];
  permissions: Record<string, boolean>;
  createdAt: string;
  _count: { goals: number; comments: number };
}

/** Section default fallback data — used when DB is empty */
export const FALLBACK_SECTIONS: SectionDataFull[] = [
  { key: "MARKETING", label: "Marketing", color: "#FF4D6A", prefix: "MRK-", sortOrder: 0, isActive: true },
  { key: "ART", label: "Art", color: "#7C3AED", prefix: "ART-", sortOrder: 1, isActive: true },
  { key: "TECHNICAL", label: "Technical", color: "#3B82F6", prefix: "TEC-", sortOrder: 2, isActive: true },
  { key: "MANAGEMENT", label: "Management", color: "#F59E0B", prefix: "MNG-", sortOrder: 3, isActive: true },
];
