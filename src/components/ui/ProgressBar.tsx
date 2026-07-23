"use client";

/**
 * ProgressBar — Visual progress indicator with animated fill.
 * Shows percentage and supports section-specific accent colors.
 */

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: string;
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  color = "var(--accent)",
  height = "h-2",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">Progress</span>
          <span className="text-xs font-semibold text-text">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-full bg-surface-2 overflow-hidden",
          height
        )}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedValue}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
