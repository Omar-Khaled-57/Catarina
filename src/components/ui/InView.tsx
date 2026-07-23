"use client";

/**
 * InView — Simple wrapper that fades children in when they scroll into view.
 * Uses IntersectionObserver with no external dependencies.
 * Supports stagger delay for sequential animations.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface InViewProps {
  children: ReactNode;
  /** Delay in ms before the animation starts */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
}

export default function InView({ children, delay = 0, className = "" }: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`in-view ${visible ? "in-view-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
