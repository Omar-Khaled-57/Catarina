"use client";

/**
 * ProgressBar — Visual progress indicator with animated fill.
 * Shows percentage and supports section-specific accent colors.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const swingOut = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: string;
  showLabel?: boolean;
  className?: string;
  animateOnMount?: boolean;
  duration?: number;
  delay?: number;
}

export default function ProgressBar({
  value,
  color = "var(--accent)",
  height = "h-2",
  showLabel = false,
  className,
  animateOnMount = false,
  duration = 2000,
  delay = 0,
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const [displayValue, setDisplayValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const fillValue = animateOnMount ? displayValue : clampedValue;

  useEffect(() => {
    if (!animateOnMount) return;

    const el = wrapperRef.current;
    if (!el) return;

    const runAnimation = (from: number, to: number, useDelay: boolean) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const startTime = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - startTime) / duration, 1);
          const next = from + (to - from) * swingOut(t);
          fromRef.current = next;
          setDisplayValue(next);

          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            fromRef.current = to;
            setDisplayValue(to);
          }
        };

        rafRef.current = requestAnimationFrame(tick);
      }, useDelay ? delay : 0);
    };

    if (hasAnimated.current) {
      runAnimation(fromRef.current, clampedValue, false);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        runAnimation(fromRef.current, clampedValue, true);
        observer.disconnect();
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [animateOnMount, clampedValue, delay, duration]);

  return (
    <div ref={wrapperRef} className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">Progress</span>
          <span className="text-xs font-semibold text-text">
            {Math.round(fillValue)}%
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
          className={cn(
            "h-full rounded-full",
            !animateOnMount && "transition-all duration-500 ease-out"
          )}
          style={{
            width: `${fillValue}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
