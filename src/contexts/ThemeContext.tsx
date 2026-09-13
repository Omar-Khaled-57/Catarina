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
    const mode = stored === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.remove("light", "dark"); /* preserve any other classes on <html> */
    root.classList.add(mode);
    return mode === "dark";
  });

  /* Sync document class when isDark changes (via toggle) */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(isDark ? "dark" : "light");
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
