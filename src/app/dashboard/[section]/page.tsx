"use client";

/**
 * Section Page — Detailed view of goals for a specific team section.
 * Card-based layout with editable progress, steps, and colorful notes.
 */

import { useState, useEffect, useCallback, useMemo, use, useRef } from "react";
import { notFound } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import GoalForm, { type GoalAssignmentData } from "@/components/GoalForm";
import GoalCard from "@/components/GoalCard";
import CommentSection from "@/components/CommentSection";
import MonthSelector from "@/components/MonthSelector";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { calcSectionStats } from "@/lib/utils";
import { toast } from "sonner";
import { type GoalData } from "@/components/GoalRow";
import { Plus, ListChecks, ArrowDownAZ, ArrowDownWideNarrow, CalendarDays, Users, Hash, ArrowUpDown, Search } from "lucide-react";

/* ─── Custom Hook: useCountUp ────────────────────────────────────────────── */
function useCountUp(target: number, duration: number = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let start = performance.now();
    const startValue = value;
    const update = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setValue(startValue + (target - startValue) * easeOut);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return value;
}

/* ─── Inline Donut Chart ─────────────────────────────────────────────────── */
function DonutChart({
  donePercent,
  remainingPercent,
  color,
  size = 180,
  strokeWidth = 22,
}: {
  donePercent: number;
  remainingPercent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const doneLen = (donePercent / 100) * circumference;
  const remainLen = (remainingPercent / 100) * circumference;

  const pad = 16;
  const outer = size + pad * 2;

  return (
    <svg
      viewBox={`0 0 ${outer} ${outer}`}
      className="w-full h-full transform -rotate-90"
      style={{ overflow: "visible" }}
    >
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={strokeWidth}
      />
      {remainLen > 0 && (
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${remainLen} ${circumference - remainLen}`}
          strokeDashoffset={-doneLen}
          style={{ transition: "stroke-dasharray 0.8s ease-out, stroke-dashoffset 0.8s ease-out" }}
        />
      )}
      {doneLen > 0 && (
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${doneLen} ${circumference - doneLen}`}
          strokeDashoffset={0}
          style={{ transition: "stroke-dasharray 0.8s ease-out", filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      )}
    </svg>
  );
}

/* ─── Main Section Page ──────────────────────────────────────────────────── */
export default function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionParam } = use(params);
  const section = sectionParam.toUpperCase();
  const { user, isAdmin } = useAuth();
  const permissions = user?.permissions || { canEditGoals: false, canDeleteGoals: false, canCreateGoals: true, canManageMembers: false, canCreateMonths: false };

  const [sectionColor, setSectionColor] = useState("var(--accent)");
  const [validSections, setValidSections] = useState<string[]>([]);

  /* Fetch sections and validate */
  useEffect(() => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data) => {
        const secs = data.sections || [];
        const keys = secs.map((s: { key: string }) => s.key);
        setValidSections(keys);

        const found = secs.find((s: { key: string }) => s.key === section);
        if (found) {
          setSectionColor(found.color);
        } else {
          notFound();
        }
      })
      .catch(() => notFound());
  }, [section]);

  const [monthId, setMonthId] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* Goal form state */
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null);

  /* Comment state */
  const [commentGoalId, setCommentGoalId] = useState<string | null>(null);
  const [commentGoalName, setCommentGoalName] = useState("");

  /* Sort state */
  type SortMode = "id" | "name" | "assignee" | "deadline";
  const [sortMode, setSortMode] = useState<SortMode>("id");
  const [sortAsc, setSortAsc] = useState(true);

  /* Search state */
  const [search, setSearch] = useState("");

  const color = sectionColor;

  /* Fetch goals for selected month + section */
  const fetchGoals = useCallback(
    async (mId: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/goals?monthId=${mId}&section=${section}`);
        const data = await res.json();
        setGoals(data.goals || []);
      } catch {
        setGoals([]);
      } finally {
        setIsLoading(false);
      }
    },
    [section]
  );

  /* Auto-select latest month */
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

  /* ─── Goal CRUD Handlers ─────────────────────────────────────────────── */
  const handleCreateGoal = async (data: {
    name: string;
    description: string;
    current: number;
    target: number;
    deadline: string;
    monthId: string;
  }) => {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, section }),
    });
    if (!res.ok) throw new Error("Failed to create goal");
    const { goal } = await res.json();
    fetchGoals(data.monthId);
    return goal?.id || null;
  };

  const handleUpdateGoal = async (data: {
    name: string;
    description: string;
    current: number;
    target: number;
    deadline: string;
    monthId: string;
  }) => {
    if (!editingGoal) return;
    const res = await fetch(`/api/goals/${editingGoal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update goal");
    fetchGoals(data.monthId);
  };

  const handleSaveAssignments = async (goalId: string, assignments: GoalAssignmentData[]) => {
    await fetch(`/api/goals/${goalId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    fetchGoals(monthId!);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Delete this goal?")) return;
    const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Goal deleted");
      fetchGoals(monthId!);
    } else {
      toast.error("Failed to delete goal");
    }
  };

  const handleToggleGoal = async (goalId: string, done: boolean) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, done } : g))
    );
    try {
      const res = await fetch(`/api/goals/${goalId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) {
        setGoals((prev) =>
          prev.map((g) => (g.id === goalId ? { ...g, done: !done } : g))
        );
        toast.error("Failed to update goal");
      }
    } catch {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, done: !done } : g))
      );
      toast.error("Failed to update goal");
    }
  };

  const handleProgressChange = async (goalId: string, current: number, target: number) => {
    /* Optimistic update */
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, current, target } : g))
    );
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, target }),
      });
      if (!res.ok) {
        fetchGoals(monthId!);
        toast.error("Failed to update progress");
      }
    } catch {
      fetchGoals(monthId!);
      toast.error("Failed to update progress");
    }
  };

  const handleAutoComplete = async (goalId: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, done: true } : g))
    );
    try {
      await fetch(`/api/goals/${goalId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
    } catch {
      fetchGoals(monthId!);
    }
  };

  /* Filter + sort goals */
  const filteredGoals = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = goals;
    if (q) {
      list = goals.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.assignments.some((a) => a.name.toLowerCase().includes(q))
      );
    }
    const dir = sortAsc ? 1 : -1;
    const copy = [...list];
    switch (sortMode) {
      case "name":
        return copy.sort((a, b) => dir * a.name.localeCompare(b.name));
      case "assignee":
        return copy.sort((a, b) => {
          const aName = a.assignments[0]?.name || "";
          const bName = b.assignments[0]?.name || "";
          if (!aName && !bName) return 0;
          if (!aName) return 1;
          if (!bName) return -1;
          return dir * aName.localeCompare(bName);
        });
      case "deadline":
        return copy.sort((a, b) => dir * (new Date(a.deadline).getTime() - new Date(b.deadline).getTime()));
      default:
        return copy.sort((a, b) => dir * (a.goalNumber - b.goalNumber));
    }
  }, [goals, sortMode, sortAsc, search]);

  const openEdit = (goal: GoalData) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const openComment = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    setCommentGoalId(goalId);
    setCommentGoalName(goal?.name || "");
  };

  const stats = calcSectionStats(goals);
  const animPercentage = useCountUp(stats.percentage);
  const animDone = Math.round(useCountUp(stats.done));
  const animRemaining = Math.round(useCountUp(stats.remaining));
  
  const sectionLabel = section.charAt(0) + section.slice(1).toLowerCase();
  const canCreate = isAdmin || permissions.canCreateGoals;

  return (
    <div className="space-y-5 px-4 sm:px-5 lg:px-6 py-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">
            {sectionLabel} Section
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            {stats.done} of {stats.total} goals completed
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditingGoal(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            New Goal
          </Button>
        )}
      </div>

      {/* ── Month Selector ───────────────────────────────────────────────── */}
      <MonthSelector currentMonthId={monthId} onSelectMonth={handleSelectMonth} showCreate={false} />

      {/* ── Donut Chart Hero Card ────────────────────────────────────────── */}
      <div
        className="glass rounded-2xl overflow-hidden"
        style={{ borderColor: `${color}25` }}
      >
        <div className="h-1 w-full" style={{ backgroundColor: color, opacity: 0.6 }} />

        <div className="p-4 sm:p-6">
          <p
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4"
            style={{ color }}
          >
            {sectionLabel} Section — Completion Overview
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <div className="text-center sm:text-right order-2 sm:order-1">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                Remaining
              </p>
              <p className="text-3xl sm:text-5xl font-black leading-none" style={{ color: "var(--text-muted)" }}>
                {(100 - animPercentage).toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              <p className="text-sm text-text-muted mt-1">
                {animRemaining} goal{animRemaining !== 1 ? "s" : ""} left
              </p>
            </div>

            <div className="relative order-1 sm:order-2 flex-shrink-0 w-[180px] h-[180px] sm:w-[232px] sm:h-[232px]">
              <DonutChart
                donePercent={stats.percentage}
                remainingPercent={100 - stats.percentage}
                color={color}
                size={164}
                strokeWidth={20}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl sm:text-3xl font-black leading-none" style={{ color }}>
                  {animPercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-text-muted mt-0.5 font-medium">done</span>
              </div>
            </div>

            <div className="text-center sm:text-left order-3">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold mb-1" style={{ color }}>
                Done
              </p>
              <p className="text-3xl sm:text-5xl font-black leading-none" style={{ color }}>
                {animPercentage.toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              <p className="text-sm mt-1" style={{ color: `${color}bb` }}>
                {animDone} goal{animDone !== 1 ? "s" : ""} done
              </p>
            </div>
          </div>
        </div>

        <div
          className="border-t px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5"
          style={{ borderColor: `${color}20`, backgroundColor: `${color}06` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Completion %</span>
            <span className="text-sm font-bold" style={{ color }}>{animPercentage.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Done</span>
            <span className="text-sm font-bold text-text">{animDone}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Remaining</span>
            <span className="text-sm font-bold text-text">{animRemaining}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Total Goals</span>
            <span className="text-sm font-bold text-text">{stats.total}</span>
          </div>
        </div>
      </div>

      {/* ── Sort + Search Controls ───────────────────────────────────────── */}
      {goals.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Sort pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 shrink-0">
              <ArrowUpDown size={12} />
              Sort:
            </span>
            {([
              { key: "id" as SortMode, label: "ID", icon: Hash },
              { key: "name" as SortMode, label: "Name", icon: ArrowDownAZ },
              { key: "assignee" as SortMode, label: "Assignee", icon: Users },
              { key: "deadline" as SortMode, label: "Deadline", icon: CalendarDays },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  sortMode === key
                    ? "text-bg"
                    : "text-text-muted hover:text-text bg-surface-2/60 hover:bg-surface-2"
                }`}
                style={sortMode === key ? { backgroundColor: color } : {}}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
            {/* Asc / Desc — no box, accent color */}
            <button
              onClick={() => setSortAsc((p) => !p)}
              className="inline-flex items-center gap-1 text-xs font-semibold transition-all duration-200"
              style={{ color }}
              title={sortAsc ? "Ascending — click for descending" : "Descending — click for ascending"}
            >
              <ArrowDownWideNarrow
                size={13}
                className={`transition-transform duration-200 ${sortAsc ? "" : "rotate-180"}`}
              />
              {sortAsc ? "ASC" : "DSC"}
            </button>
          </div>

          {/* Search */}
          <div className="relative sm:w-56 shrink-0">
            <label htmlFor="goal-search" className="sr-only">Search goals</label>
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-text-muted pointer-events-none" aria-hidden="true" />
            <input
              id="goal-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals..."
              className="w-full rounded-lg bg-surface-2/60 border border-border/40 ps-8 pe-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>
      )}

      {/* ── Goal Cards Grid ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `${color}40`, borderTopColor: "transparent" }}
          />
        </div>
      ) : goals.length === 0 ? (
        <div className="glass rounded-2xl text-center py-20 text-text-muted">
          <Image src="/rina/think.webp" alt="Catarina thinking" width={120} height={120} className="mx-auto mb-3 rounded-2xl" />
          <p className="text-lg font-semibold">No goals in this section yet</p>
          <p className="text-sm mt-1 opacity-60">
            {canCreate ? 'Click "New Goal" to add one.' : "Ask an admin to create goals."}
          </p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16 text-text-muted">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">No goals match your search</p>
        </div>
      ) : (
        <motion.div
          key={`${sortMode}-${sortAsc}-${search}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-4 grid-cols-1 sm:grid-cols-2"
        >
          <AnimatePresence initial={false}>
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                userId={user?.id || ""}
                isAdmin={isAdmin}
                permissions={permissions}
                color={color}
                onToggle={handleToggleGoal}
                onEdit={openEdit}
                onDelete={handleDeleteGoal}
                onComment={openComment}
                onProgressChange={handleProgressChange}
                onAutoComplete={handleAutoComplete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Goal Form Modal ──────────────────────────────────────────────── */}
      <GoalForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGoal(null);
        }}
        onSave={editingGoal ? handleUpdateGoal : handleCreateGoal}
        onSaveAssignments={handleSaveAssignments}
        initialData={editingGoal ? { ...editingGoal, assignments: editingGoal.assignments.map((a) => ({ userId: a.userId, canCheck: a.canCheck, canEdit: a.canEdit })) } : null}
        isAdmin={isAdmin}
        section={section}
        goalId={editingGoal?.id}
      />

      {/* ── Comment Section Modal ────────────────────────────────────────── */}
      <CommentSection
        isOpen={!!commentGoalId}
        onClose={() => setCommentGoalId(null)}
        goalId={commentGoalId || ""}
        goalName={commentGoalName}
      />
    </div>
  );
}
