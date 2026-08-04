"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type GoalData } from "@/types";
import { mergeGoalsDedupeTemp, type Mergeable } from "@/lib/mergeGoals";

interface UseGoalMergeOptions<T extends Mergeable> {
  generation: number;
  snapshotRef: React.RefObject<{ goals: GoalData[]; sectionChanged: boolean; generation: number }>;
  setGoals: React.Dispatch<React.SetStateAction<T[]>>;
  onSectionChanged?: () => void;
}

/**
 * Shared hook that consumes delta goals from useRealtimeSync and merges
 * them into the page's goal state. Also tracks new goal IDs for glow effects
 * and the sections touched by the latest delta for card pulsing.
 *
 * Returns:
 * - `getIsNewGoalIds` — a Set of goal IDs that arrived via the latest delta
 *   (auto-clears after 2 seconds for glow animation timing)
 * - `lastDeltaSections` — the sections touched by the latest delta
 *   (auto-clears after 3 seconds; consumers derive pulse UI during render)
 *
 * No resetDeltas call needed — uses ref-based consumption.
 */
export function useGoalMerge<T extends Mergeable>({
  generation,
  snapshotRef,
  setGoals,
  onSectionChanged,
}: UseGoalMergeOptions<T>) {
  const isNewGoalIdsRef = useRef<Set<string>>(new Set());
  const [lastDeltaSections, setLastDeltaSections] = useState<string[]>([]);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Bump this to trigger a re-render so consumers see updated isNewGoalIds */
  const [, setRenderTick] = useState(0);

  const getIsNewGoalIds = useCallback(() => isNewGoalIdsRef.current, []);

  useEffect(() => {
    if (generation === 0) return;

    const { goals: deltaGoals, sectionChanged } = snapshotRef.current;

    /* Merge delta goals — targeted upsert (only replace changed IDs) */
    if (deltaGoals.length > 0) {
      setGoals((prev) => mergeGoalsDedupeTemp(prev, deltaGoals));

      /* Track new IDs for glow effect */
      isNewGoalIdsRef.current = new Set(deltaGoals.map((g) => g.id));
      setLastDeltaSections([...new Set(deltaGoals.map((g) => g.section))]);
      setRenderTick((k) => k + 1);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        isNewGoalIdsRef.current = new Set();
        setRenderTick((k) => k + 1);
      }, 2000);
      if (clearPulseTimerRef.current) clearTimeout(clearPulseTimerRef.current);
      clearPulseTimerRef.current = setTimeout(() => setLastDeltaSections([]), 3000);
    }

    /* Handle section config changes */
    if (sectionChanged && onSectionChanged) {
      onSectionChanged();
    }
  }, [generation, snapshotRef, setGoals, onSectionChanged]);

  return { getIsNewGoalIds, lastDeltaSections };
}

