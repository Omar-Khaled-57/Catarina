"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Smart polling hook with visibility + idle detection.
 * - Active tab: polls at `interval`
 * - Idle tab (>2min no mouse/keyboard): polls at interval * 3
 * - Hidden tab: polls at interval * 6
 * - Focus event: immediate check, then resumes normal interval
 *
 * Uses a chained setTimeout (not setInterval) so the effective interval is
 * re-evaluated after every poll, and overlapping calls are prevented when the
 * callback is asynchronous.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  interval = 5000,
  enabled = true,
) {
  const savedCallback = useRef(callback);
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

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        void run();
      }, delay);
    };

    const run = async () => {
      if (stopped) return;
      try {
        await savedCallback.current();
      } finally {
        if (!stopped) schedule(getEffectiveInterval());
      }
    };

    /* Initialize activity timestamp */
    lastActivityRef.current = Date.now();

    /* Activity tracking — resets idle timer */
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    /* Visibility tracking — pauses/resumes on tab switch */
    const onVisible = () => {
      pausedRef.current = document.visibilityState !== "visible";
      if (!pausedRef.current) {
        void run(); /* immediate check on focus */
      }
    };

    document.addEventListener("mousemove", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);

    void run(); /* immediate first call */

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, getEffectiveInterval]);
}
