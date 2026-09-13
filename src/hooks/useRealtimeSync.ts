"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
 * A context switch (monthId/section change) during an in-flight request drops the
 * stale response so old-context goals are never merged into the new context.
 */
export function useRealtimeSync({
  monthId,
  section,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const prevSectionsRef = useRef<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const snapshotRef = useRef<DeltaSnapshot>({ goals: [], sectionChanged: false, generation: 0 });
  const [failCount, setFailCount] = useState(0);
  const inFlightRef = useRef(false);

  /* Requested context. Updated on render; poll reads it so an in-flight
   * request always knows which context it was started for. */
  const contextRef = useRef({ monthId, section });
  useEffect(() => {
    contextRef.current = { monthId, section };
  }, [monthId, section]);

  const poll = useCallback(async () => {
    /* Prevent overlapping requests if a poll takes longer than the interval */
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const context = contextRef.current;

    try {
      const params = new URLSearchParams({
        since: lastCheckRef.current,
      });
      if (context.monthId) params.set("monthId", context.monthId);
      if (context.section) params.set("section", context.section);

      const res = await fetch(`/api/changes?${params}`);
      if (!res.ok) throw new Error(`changes: ${res.status}`);
      const data: ChangeState = await res.json();

      /* Context switched while this request was in flight — drop it entirely
       * (do not publish, do not advance the checkpoint). */
      if (
        contextRef.current.monthId !== context.monthId ||
        contextRef.current.section !== context.section
      ) {
        return;
      }

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
        if (context.monthId) goalParams.set("monthId", context.monthId);
        if (context.section) goalParams.set("section", context.section);

        const goalRes = await fetch(`/api/goals?${goalParams}`);
        if (!goalRes.ok) throw new Error(`goals: ${goalRes.status}`);
        const goalData = await goalRes.json();
        if (goalData.goals?.length > 0) {
          goals = goalData.goals;
          hasChanges = true;
        }
      }

      /* Re-check after the second fetch — a switch mid-goal-fetch must also
       * drop this response rather than merging into the new context. */
      if (
        contextRef.current.monthId !== context.monthId ||
        contextRef.current.section !== context.section
      ) {
        return;
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
      /* Exponential backoff on any failure (network, 5xx, bad payload) */
      setFailCount((c) => Math.min(c + 1, 4));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  /* Adaptive interval: 5s → 10s → 20s → 30s → 30s cap */
  const interval = Math.min(5000 * Math.pow(2, failCount), 30000);
  usePolling(poll, interval, enabled);

  return { generation, snapshotRef };
}
