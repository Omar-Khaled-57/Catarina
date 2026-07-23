"use client";

/**
 * Badge — Small colored label for status indicators.
 * Supports section-specific colors and status variants.
 */

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "section";
  section?: string;
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  section,
  className,
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  const variants = {
    default: "bg-surface-2 text-text-muted",
    success: "bg-accent/15 text-accent border border-accent/20",
    warning: "bg-warning/15 text-warning border border-warning/20",
    danger: "bg-danger/15 text-danger border border-danger/20",
    section: cn(
      section === "MARKETING" && "bg-[#00E8A2]/15 text-[#00E8A2] border border-[#00E8A2]/20",
      section === "ART" && "bg-[#7C3AED]/15 text-[#7C3AED] border border-[#7C3AED]/20",
      section === "TECHNICAL" && "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20",
      section === "MANAGEMENT" && "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20"
    ),
  };

  return (
    <span className={cn(base, variants[variant], className)}>{children}</span>
  );
}
