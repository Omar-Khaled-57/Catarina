"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type GoalData } from "@/types";

interface UseGoalMergeOptions {
  generation: number;
  snapshotRef: React.RefObject<{ goals: GoalData[]; sectionChanged: boolean; generation: number }>;
  setGoals: React.Dispatch<React.SetStateAction<GoalData[]>>;
  onSectionChanged?: () => void;
}

/**
 * Shared hook that consumes delta goals from useRealtimeSync and merges
 * them into the page's goal state. Also tracks new goal IDs for glow effects.
 *
 * Returns `getIsNewGoalIds` — returns a Set of goal IDs that arrived via the latest delta.
 * The set auto-clears after 2 seconds (for glow animation timing).
 *
 * No resetDeltas call needed — uses ref-based consumption.
 */
export function useGoalMerge({
  generation,
  snapshotRef,
  setGoals,
  onSectionChanged,
}: UseGoalMergeOptions) {
  const isNewGoalIdsRef = useRef<Set<string>>(new Set());
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Bump this to trigger a re-render so consumers see updated isNewGoalIds */
  const [, setRenderTick] = useState(0);

  const getIsNewGoalIds = useCallback(() => isNewGoalIdsRef.current, []);

  useEffect(() => {
    if (generation === 0) return;

    const { goals: deltaGoals, sectionChanged } = snapshotRef.current;

    /* Merge delta goals — targeted patch (only replace changed IDs) */
    if (deltaGoals.length > 0) {
      const deltaIds = new Set(deltaGoals.map((g) => g.id));
      setGoals((prev) => {
        /* Fast path: all goals are new (no existing match) */
        const hasExisting = prev.some((g) => deltaIds.has(g.id));
        if (!hasExisting) return [...prev, ...deltaGoals];

        /* Slow path: replace changed, keep unchanged */
        return prev.map((g) =>
          deltaIds.has(g.id) ? deltaGoals.find((d) => d.id === g.id)! : g
        );
      });

      /* Track new IDs for glow effect */
      isNewGoalIdsRef.current = new Set(deltaGoals.map((g) => g.id));
      setRenderTick((k) => k + 1);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        isNewGoalIdsRef.current = new Set();
        setRenderTick((k) => k + 1);
      }, 2000);
    }

    /* Handle section config changes */
    if (sectionChanged && onSectionChanged) {
      onSectionChanged();
    }
  }, [generation, snapshotRef, setGoals, onSectionChanged]);

  return { getIsNewGoalIds };
}
