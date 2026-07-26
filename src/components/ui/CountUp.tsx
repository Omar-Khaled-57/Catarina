"use client";

/**
 * CountUp — Animated number that counts from 0 to target value.
 * Uses requestAnimationFrame with ease-out swing for buttery-smooth motion.
 * Only starts counting when the element scrolls into view (IntersectionObserver).
 * Supports delay, duration, decimal places, prefix/suffix.
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
  const rafRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function startAnimation() {
      const from = fromRef.current;
      const to = value;

      setTimeout(() => {
        const startTime = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - startTime) / duration, 1);
          setDisplay((from + (to - from) * swingOut(t)).toFixed(decimals));
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            fromRef.current = to;
            setDisplay(to.toFixed(decimals));
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }, delay);

      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* Re-animate when value changes after initial animation */
  useEffect(() => {
    if (!hasAnimated.current) return;
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      setDisplay((from + (to - from) * swingOut(t)).toFixed(decimals));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to.toFixed(decimals));
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration, decimals]);

  return (
    <span ref={wrapperRef} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
