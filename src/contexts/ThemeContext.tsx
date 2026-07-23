"use client";

/**
 * ThemeContext — Manages dark/light theme toggle.
 * Defaults to dark mode (matching Hodor's default).
 * Persists preference to localStorage.
 * Uses lazy initialization to avoid setState-in-effect.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* Lazy-initialize from localStorage to avoid setState-in-effect */
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("catarina-theme");
    if (stored) {
      document.documentElement.className = stored;
      return stored === "dark";
    }
    document.documentElement.className = "dark";
    return true;
  });

  /* Sync document class when isDark changes (via toggle) */
  useEffect(() => {
    const mode = isDark ? "dark" : "light";
    document.documentElement.className = mode;
  }, [isDark]);

  /* Toggle between dark and light themes */
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const mode = next ? "dark" : "light";
      localStorage.setItem("catarina-theme", mode);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
