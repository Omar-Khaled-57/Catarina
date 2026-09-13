"use client";

/**
 * ThemeToggleButton — accessible dark/light toggle (label + icon, aria-pressed).
 * Used on the public /privacy and /terms pages where there is no navbar.
 */

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggleButton() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={!isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}