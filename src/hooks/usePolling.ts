"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Smart polling hook with visibility + idle detection.
 * - Active tab: polls at `interval` (default 5s)
 * - Idle tab (>2min no mouse/keyboard): polls at interval * 3
 * - Hidden tab: polls at interval * 6 or pauses
 * - Focus event: immediate call, then resumes normal interval
 */
export function usePolling(
  callback: () => void,
  interval = 5000,
  enabled = true,
) {
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(0);
  const pausedRef = useRef(false);

  /* Keep callback ref fresh without re-triggering effect */
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const getEffectiveInterval = useCallback(() => {
    if (pausedRef.current) return interval * 6;

    const idle = Date.now() - lastActivityRef.current > 2 * 60 * 1000;
    if (idle) return interval * 3;

    return interval;
  }, [interval]);

  const tick = useCallback(() => {
    savedCallback.current();
  }, []);

  /* Reset interval when activity detected */
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(tick, getEffectiveInterval());
  }, [tick, getEffectiveInterval]);

  useEffect(() => {
    if (!enabled) return;

    /* Initialize activity timestamp */
    lastActivityRef.current = Date.now();

    /* Start polling */
    tick(); /* immediate first call */
    timerRef.current = setInterval(tick, getEffectiveInterval());

    /* Activity tracking — resets idle timer */
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    document.addEventListener("mousemove", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity, { passive: true });

    /* Visibility tracking — pauses/resumes on tab switch */
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        pausedRef.current = false;
        tick(); /* immediate check on focus */
        resetTimer();
      } else {
        pausedRef.current = true;
        resetTimer(); /* switch to idle interval */
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, tick, getEffectiveInterval, resetTimer]);
}
