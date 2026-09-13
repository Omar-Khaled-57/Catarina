"use client";

/**
 * CountUp — Animated number that counts from 0 to target value.
 * Uses requestAnimationFrame with ease-out swing for buttery-smooth motion.
 * Only starts counting when the element scrolls into view (IntersectionObserver).
 * Supports delay, duration, decimal places, prefix/suffix.
 *
 * Single effect keyed on `value`: first run waits for intersection, later
 * runs re-animate immediately from the current display value. The effect's
 * cleanup cancels any in-flight RAF so a mid-animation value change can't
 * double-drive setState.
 */

import { useEffect, useRef, useState } from "react";

/** ease-out swing: starts fast, decelerates smoothly */
const swingOut = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

interface CountUpProps {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
  prefix?: string;
  suffix?: string;
}

export default function CountUp({
  value,
  duration = 2000,
  delay = 0,
  decimals = 0,
  className,
  style,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const [display, setDisplay] = useState("0");
  const fromRef = useRef(0);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    /* No change from the last animated value → nothing to do. */
    if (hasAnimated.current && fromRef.current === value) return;

    let raf: number | null = null;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: IntersectionObserver | null = null;
    let disposed = false;

    const animate = (effectiveDelay: number, from: number, to: number) => {
      delayTimer = setTimeout(() => {
        if (disposed) return;
        const startTime = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          const t = Math.min((now - startTime) / duration, 1);
          setDisplay((from + (to - from) * swingOut(t)).toFixed(decimals));
          if (t < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            fromRef.current = to;
            setDisplay(to.toFixed(decimals));
          }
        };
        raf = requestAnimationFrame(tick);
      }, effectiveDelay);
    };

    if (hasAnimated.current) {
      /* Value changed after the initial animation — re-animate immediately
       * from the last displayed value (no delay, no scroll wait). */
      animate(0, fromRef.current, value);
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate(delay, 0, value);
            observer?.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(el);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (delayTimer) clearTimeout(delayTimer);
      if (raf) cancelAnimationFrame(raf);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- only the target value re-triggers */
  }, [value]);

  return (
    <span ref={wrapperRef} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
