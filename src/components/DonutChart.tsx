"use client";

import { useState, useEffect } from "react";

/**
 * Animated donut chart using SVG stroke-dasharray.
 * Used on section pages and dashboard stats.
 */
export default function DonutChart({
  donePercent,
  color,
  size = 180,
  strokeWidth = 22,
}: {
  donePercent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const doneLen = (donePercent / 100) * circumference;

  const pad = 16;
  const outer = size + pad * 2;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const animatedDone = mounted ? doneLen : 0;
  const animatedOffset = mounted ? 0 : circumference;

  return (
    <svg
      viewBox={`0 0 ${outer} ${outer}`}
      className="w-full h-full transform -rotate-90"
      style={{ overflow: "visible" }}
    >
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={radius}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${animatedDone} ${circumference - animatedDone}`}
        strokeDashoffset={animatedOffset}
        style={{
          transition:
            "stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1), stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
          filter: `drop-shadow(0 0 10px ${color}90)`,
        }}
      />
    </svg>
  );
}
