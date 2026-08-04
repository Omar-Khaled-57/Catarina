"use client";

/**
 * Badge — Small colored label for status indicators.
 * Supports section-specific colors and status variants.
 */

import { cn } from "@/lib/utils";
import { SECTION_COLORS } from "@/lib/auth";

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

  if (variant === "section") {
    const c = color || (section ? SECTION_COLORS[section] : undefined) || "var(--accent)";
    return (
      <span
        className={cn(base, className)}
        style={{ backgroundColor: `${c}15`, color: c, border: `1px solid ${c}30` }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={cn(base, variants[variant], className)}>{children}</span>
  );
}
