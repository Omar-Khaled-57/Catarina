"use client";

/**
 * Dashboard Page — Main overview showing all 4 section cards.
 * Fetches goals for the current month and displays section-level stats.
 * Includes section completion bar chart for at-a-glance performance.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import SectionCard from "@/components/SectionCard";
import SectionChart from "@/components/SectionChart";
import MonthSelector from "@/components/MonthSelector";
import CountUp from "@/components/ui/CountUp";
import InView from "@/components/ui/InView";
import { SECTIONS, type Section } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { calcSectionStats } from "@/lib/utils";
import { LayoutList, Target, CheckCircle2, Clock, TrendingUp } from "lucide-react";

/** Goal data structure from the API */
interface Goal {
  id: string;
  name: string;
  description: string;
  current: number;
  target: number;
  done: boolean;
  deadline: string;
  carriedOver: boolean;
  section: string;
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [monthId, setMonthId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  /* Group goals by section */
  const goalsBySection = SECTIONS.reduce(
    (acc, section) => {
      acc[section] = goals.filter((g) => g.section === section);
      return acc;
    },
    {} as Record<Section, Goal[]>
  );

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
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-text-muted">
            <LayoutList size={32} strokeWidth={1.5} />
          </div>
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
          <div className="glass rounded-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-marketing via-art to-management opacity-60" />
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(0,232,162,0.1)", border: "1px solid rgba(0,232,162,0.2)" }}>
                  <CheckCircle2 size={18} style={{ color: "#00E8A2" }} />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Done</p>
                  <CountUp
                    value={globalStats.done}
                    delay={350}
                    className="text-2xl font-black"
                    style={{ color: "#00E8A2" }}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECTIONS.map((section, i) => (
              <InView key={section} delay={150 * (i + 1)}>
                <SectionCard
                  section={section}
                  goals={goalsBySection[section]}
                  highlight={
                    isAdmin
                      ? section === (user?.primarySection || "MANAGEMENT")
                      : user?.sections.includes(section)
                  }
                />
              </InView>
            ))}
          </div>

          {/* Performance Chart */}
          <SectionChart data={goalsBySection} />
        </>
      )}
    </div>
  );
}
