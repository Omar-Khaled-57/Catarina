"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 to target with ease-out-expo easing.
 * Returns the current animated value.
 */
export default function useCountUp(target: number, duration: number = 1000) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const startValue = 0;
    const update = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 1 ? 1 - Math.pow(2, -10 * t) : 1;
      setValue(startValue + (target - startValue) * ease);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(update);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
