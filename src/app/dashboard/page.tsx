"use client";

/**
 * Dashboard Page — Main overview showing all 4 section cards.
 * Fetches goals for the current month and displays section-level stats.
 * Includes section completion bar chart for at-a-glance performance.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import SectionCard from "@/components/SectionCard";
import SectionChart from "@/components/SectionChart";
import MonthSelector from "@/components/MonthSelector";
import CountUp from "@/components/ui/CountUp";
import InView from "@/components/ui/InView";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { type SectionData, type DashboardGoal } from "@/types";
import { Target, CheckCircle2, Clock, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [monthId, setMonthId] = useState<string | null>(null);
  const [goals, setGoals] = useState<DashboardGoal[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* Fetch sections */
  useEffect(() => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => {});
  }, []);

  /* Fetch goals for the selected month */
  const fetchGoals = useCallback(async (mId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/goals?monthId=${mId}`);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch {
      setGoals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* Auto-select latest month on mount */
  useEffect(() => {
    fetch("/api/months")
      .then((res) => res.json())
      .then((data) => {
        if (data.months?.length > 0) {
          const latest = data.months[data.months.length - 1];
          setMonthId(latest.id);
          fetchGoals(latest.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false));
  }, [fetchGoals]);

  const handleSelectMonth = (mId: string) => {
    setMonthId(mId);
    fetchGoals(mId);
  };

  /* ─── Realtime Sync ──────────────────────────────────────────────────────── */
  const { generation, snapshotRef } = useRealtimeSync({
    monthId: monthId || undefined,
    enabled: !!monthId,
  });
  const [changedSections, setChangedSections] = useState<Set<string>>(new Set());
  const clearPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Merge delta goals + track section pulse */
  useEffect(() => {
    if (generation === 0) return;
    const { goals: deltaGoals, sectionChanged } = snapshotRef.current;

    if (deltaGoals.length > 0) {
      setGoals((prev) => {
        const deltaIds = new Set(deltaGoals.map((g) => g.id));
        const hasExisting = prev.some((g) => deltaIds.has(g.id));
        if (!hasExisting) return [...prev, ...deltaGoals];
        return prev.map((g) =>
          deltaIds.has(g.id) ? deltaGoals.find((d) => d.id === g.id)! : g
        );
      });

      const affected = new Set(deltaGoals.map((g) => g.section));
      setChangedSections(affected);
      if (clearPulseTimerRef.current) clearTimeout(clearPulseTimerRef.current);
      clearPulseTimerRef.current = setTimeout(() => setChangedSections(new Set()), 3000);
    }

    if (sectionChanged) {
      fetch("/api/sections")
        .then((res) => res.json())
        .then((data) => setSections(data.sections || []));
    }
  }, [generation, snapshotRef]);

  /* Group goals by section */
  const goalsBySection = useMemo(() => {
    const acc: Record<string, DashboardGoal[]> = {};
    for (const s of sections) {
      acc[s.key] = goals.filter((g) => g.section === s.key);
    }
    return acc;
  }, [goals, sections]);

  /* Global stats across all sections */
  const globalStats = useMemo(() => {
    const total = goals.length;
    const done = goals.filter((g) => g.done).length;
    const remaining = total - done;
    const percentage = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;
    return { total, done, remaining, percentage };
  }, [goals]);

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <MonthSelector
        currentMonthId={monthId}
        onSelectMonth={handleSelectMonth}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Image src="/rina/think.webp" alt="Catarina thinking" width={160} height={160} className="w-24 sm:w-40 h-auto mb-6 drop-shadow-sm rounded-2xl" />
          <h3 className="text-lg font-bold text-text">No Goals Yet</h3>
          <p className="mt-1 text-sm text-text-muted max-w-sm">
            No goals have been created for this month yet. Create a new month or
            add goals to get started.
          </p>
        </div>
      ) : (
        <>
          {/* ── Global Summary Stats Bar ─────────────────────────────── */}
          <InView>
          <div className="glass rounded-2xl overflow-hidden" aria-live="polite" aria-label="Goal statistics">
            <div className="dashboard-gradient-bar h-1 w-full bg-gradient-to-r from-marketing via-art to-management opacity-70" />
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                  <Target size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Total Goals</p>
                  <CountUp
                    value={globalStats.total}
                    delay={200}
                    className="text-2xl font-black text-text"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                  <CheckCircle2 size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Done</p>
                  <CountUp
                    value={globalStats.done}
                    delay={350}
                    className="text-2xl font-black text-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 border border-warning/20">
                  <Clock size={18} className="text-warning" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Remaining</p>
                  <CountUp
                    value={globalStats.remaining}
                    delay={500}
                    className="text-2xl font-black text-text"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                  <TrendingUp size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Completion</p>
                  <CountUp
                    value={globalStats.percentage}
                    decimals={1}
                    suffix="%"
                    delay={650}
                    className="text-2xl font-black text-accent"
                  />
                </div>
              </div>
            </div>
          </div>
          </InView>

          {/* Section Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-live="polite" aria-label="Section cards">
            {sections.map((section, i) => (
              <InView key={section.key} delay={150 * (i + 1)}>
                <SectionCard
                  section={section.key}
                  goals={goalsBySection[section.key] || []}
                  highlight={
                    isAdmin
                      ? section.key === (user?.primarySection || "MANAGEMENT")
                      : user?.sections.includes(section.key)
                  }
                  color={section.color}
                  label={section.label}
                  hasNewActivity={changedSections.has(section.key)}
                />
              </InView>
            ))}
          </div>

          {/* Performance Chart */}
          <SectionChart data={goalsBySection} sections={sections} />
        </>
      )}
    </div>
  );
}
