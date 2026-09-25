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

/* Long-lived per-device "remember me" token. The HttpOnly session cookie
   expires — this token lets the app silently re-issue it on every visit, so
   the device never asks for credentials again. */
const REFRESH_TOKEN_KEY = "catarina-refresh";

function getStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveStoredRefreshToken(token: string | null | undefined): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    /* localStorage unavailable (private mode) — session still works. */
  }
}

function clearStoredRefreshToken(): void {
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
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

  /* Fetch current user on mount. If the session cookie has expired, try the
     device's long-lived refresh token (localStorage) first — it silently
     re-issues the cookie so returning users go straight to the dashboard. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = res.ok ? await res.json() : null;

        if (data?.user) {
          if (cancelled) return;
          setUser(data.user);
          if (data?.hasUpdate) {
            setUpdateData({
              hasUpdate: true,
              updateVersion: data.updateVersion,
              updateType: data.updateType,
              updateTitle: data.updateTitle,
              updateEntries: data.updateEntries,
            });
          }
          return;
        }

        /* No active session — silently exchange the device refresh token for
           a fresh cookie, then load the full /me payload (user + updates). */
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          const rr = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => null);

          if (rr?.ok) {
            /* Rotation: the server spent the token we just sent and returned a
               replacement. Persist it immediately — keeping the spent copy
               would make the next load look like a stolen-token replay and get
               the whole family revoked. */
            const rotated = await rr.json().catch(() => null);
            if (rotated?.refreshToken) {
              saveStoredRefreshToken(rotated.refreshToken);
            }
            await refreshUser();
            return;
          }
          clearStoredRefreshToken();
        }

        if (!cancelled) setUser(null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  /* Login with email/password */
  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.user) {
          setUser(data.user);
          saveStoredRefreshToken(data.refreshToken);
          return { success: true };
        }
        return { success: false, error: data?.error || "Login failed" };
      } catch {
        return { success: false, error: "Network error, please try again" };
      }
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
      try {
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
        const data = await res.json().catch(() => null);
        if (res.ok) {
          return { success: true };
        }
        return { success: false, error: data?.error || "Registration failed" };
      } catch {
        return { success: false, error: "Network error, please try again" };
      }
    },
    []
  );

  /* Logout — revoke the device refresh token server-side, then clear it and
     the session cookie so the user isn't silently logged back in. */
  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    } else {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    clearStoredRefreshToken();
    setUser(null);
    setUpdateData(null);
    window.location.href = "/";
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
