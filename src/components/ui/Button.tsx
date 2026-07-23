"use client";

/**
 * Button — Reusable button with variants.
 * Supports accent (primary), danger, ghost, and outline styles.
 * Includes loading state with spinner animation.
 */

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "accent" | "danger" | "ghost" | "outline";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "accent", isLoading, className, disabled, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      accent:
        "bg-accent text-bg shadow-[0_0_20px_var(--color-accent-glow)] hover:brightness-110",
      danger:
        "bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20",
      ghost:
        "bg-transparent text-text-muted hover:bg-surface-2 hover:text-text",
      outline:
        "border border-border bg-transparent text-text hover:bg-surface-2",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
