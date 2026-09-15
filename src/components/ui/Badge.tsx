"use client";

/**
 * Badge — Small colored label for status indicators.
 * Supports section-specific colors and status variants.
 */

import { cn } from "@/lib/utils";
import { SECTION_COLORS } from "@/lib/auth";
import { useThemeSafeTextColor } from "@/lib/themeSafeColor";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "section";
  section?: string;
  color?: string;
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  section,
  color,
  className,
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  const variants = {
    default: "bg-surface-2 text-text-muted",
    success: "bg-accent/15 text-accent border border-accent/20",
    warning: "bg-warning/15 text-warning border border-warning/20",
    danger: "bg-danger/15 text-danger border border-danger/20",
    section: undefined as string | undefined,
  };

  const sectionColor =
    color || (section ? SECTION_COLORS[section] : undefined) || "var(--accent)";
  const safeText = useThemeSafeTextColor(sectionColor);

  if (variant === "section") {
    return (
      <span
        className={cn(base, className)}
        style={{ backgroundColor: `${safeText}15`, color: safeText, border: `1px solid ${safeText}30` }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={cn(base, variants[variant], className)}>{children}</span>
  );
}
