"use client";

import { useState, useRef, useCallback } from "react";
import { usePolling } from "./usePolling";
import { type GoalData } from "@/types";

interface ChangeState {
  goalsUpdatedAt: string | null;
  sectionsVersion: string | null;
  newNotifications: number;
}

export interface UseRealtimeSyncOptions {
  monthId?: string;
  section?: string;
  enabled?: boolean;
  onNotificationCount?: (count: number) => void;
}

export interface DeltaSnapshot {
  goals: GoalData[];
  sectionChanged: boolean;
  generation: number;
}

/**
 * Core realtime sync hook — polls /api/changes for deltas.
 *
 * Uses ref-based storage to avoid double-renders:
 * - Deltas are stored in a ref (not state)
 * - A `generation` counter (state) increments when new data arrives
 * - Consumer watches `generation`, reads `snapshotRef.current`, merges — no reset needed
 *
 * Implements exponential backoff on consecutive failures (5s → 10s → 20s → 30s cap).
 */
export function useRealtimeSync({
  monthId,
  section,
  enabled = true,
  onNotificationCount,
}: UseRealtimeSyncOptions) {
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const prevSectionsRef = useRef<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const snapshotRef = useRef<DeltaSnapshot>({ goals: [], sectionChanged: false, generation: 0 });
  const [failCount, setFailCount] = useState(0);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        since: lastCheckRef.current,
      });
      if (monthId) params.set("monthId", monthId);
      if (section) params.set("section", section);

      const res = await fetch(`/api/changes?${params}`);
      if (!res.ok) return;
      const data: ChangeState = await res.json();

      let hasChanges = false;
      let sectionChanged = false;
      let goals: GoalData[] = [];

      /* Track section changes */
      if (
        data.sectionsVersion &&
        data.sectionsVersion !== prevSectionsRef.current
      ) {
        prevSectionsRef.current = data.sectionsVersion;
        sectionChanged = true;
        hasChanges = true;
      }

      /* Fetch goal deltas if goals changed */
      if (data.goalsUpdatedAt && data.goalsUpdatedAt > lastCheckRef.current) {
        const goalParams = new URLSearchParams({
          since: lastCheckRef.current,
        });
        if (monthId) goalParams.set("monthId", monthId);
        if (section) goalParams.set("section", section);

        const goalRes = await fetch(`/api/goals?${goalParams}`);
        if (goalRes.ok) {
          const goalData = await goalRes.json();
          if (goalData.goals?.length > 0) {
            goals = goalData.goals;
            hasChanges = true;
          }
        }
      }

      /* Handle new notifications */
      if (data.newNotifications > 0) {
        onNotificationCount?.(data.newNotifications);
      }

      /* Advance the checkpoint */
      lastCheckRef.current = new Date().toISOString();

      /* Publish snapshot + bump generation (single state update) */
      if (hasChanges) {
        const nextGen = snapshotRef.current.generation + 1;
        snapshotRef.current = { goals, sectionChanged, generation: nextGen };
        setGeneration(nextGen);
      }

      /* Reset backoff on success */
      setFailCount(0);
    } catch {
      /* Exponential backoff */
      setFailCount((c) => Math.min(c + 1, 4));
    }
  }, [monthId, section, onNotificationCount]);

  /* Adaptive interval: 5s → 10s → 20s → 30s → 30s cap */
  const interval = Math.min(5000 * Math.pow(2, failCount), 30000);
  usePolling(poll, interval, enabled);

  return { generation, snapshotRef };
}
