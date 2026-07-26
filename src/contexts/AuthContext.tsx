"use client";

/**
 * AuthContext — Manages user authentication state.
 * Provides login, logout, register, and user info.
 * Persists session via HttpOnly JWT cookie.
 * Also manages version update state for the UpdateModal.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type MemberPermissions } from "@/lib/permissions";

/** User data returned from the /api/auth/me endpoint */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  sections: string[];
  primarySection: string | null;
  welcomeSeen: boolean;
  permissions: MemberPermissions;
}

interface ChangelogEntry {
  icon: string;
  text: string;
}

interface UpdateData {
  hasUpdate: boolean;
  updateVersion?: string;
  updateType?: "major" | "minor" | "patch";
  updateTitle?: string;
  updateEntries?: ChangelogEntry[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    section: string,
    pfp: File | null
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
  /* Update modal state */
  updateData: UpdateData | null;
  markUpdateSeen: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
  markWelcomeSeen: async () => {},
  updateData: null,
  markUpdateSeen: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updateData, setUpdateData] = useState<UpdateData | null>(null);

  /* Fetch current user on mount */
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data?.user ?? null);
        if (data?.hasUpdate) {
          setUpdateData({
            hasUpdate: true,
            updateVersion: data.updateVersion,
            updateType: data.updateType,
            updateTitle: data.updateTitle,
            updateEntries: data.updateEntries,
          });
        }
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  /* Login with email/password */
  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Login failed" };
    },
    []
  );

  /* Register a new user (creates pending approval — no login) */
  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      section: string,
      pfp: File | null
    ): Promise<{ success: boolean; error?: string }> => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("section", section);
      if (pfp) formData.append("pfp", pfp);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: data.error || "Registration failed" };
    },
    []
  );

  /* Logout and clear user state */
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUpdateData(null);
  }, []);

  /* Re-fetch current user from server */
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        if (data?.hasUpdate) {
          setUpdateData({
            hasUpdate: true,
            updateVersion: data.updateVersion,
            updateType: data.updateType,
            updateTitle: data.updateTitle,
            updateEntries: data.updateEntries,
          });
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  /* Mark welcome as seen */
  const markWelcomeSeen = useCallback(async () => {
    try {
      await fetch("/api/auth/welcome-seen", { method: "POST" });
      setUser((prev) => (prev ? { ...prev, welcomeSeen: true } : null));
    } catch { /* silent */ }
  }, []);

  /* Mark update as seen — dismisses UpdateModal */
  const markUpdateSeen = useCallback(async () => {
    try {
      await fetch("/api/updates/seen", { method: "POST" });
      setUpdateData(null);
    } catch { /* silent */ }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: user?.role === "ADMIN",
        login,
        register,
        logout,
        refreshUser,
        markWelcomeSeen,
        updateData,
        markUpdateSeen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
