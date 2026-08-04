"use client";

/**
 * Section Page — Detailed view of goals for a specific team section.
 * Card-based layout with editable progress, steps, and colorful notes.
 */

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { notFound, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import GoalForm, { type GoalAssignmentData } from "@/components/GoalForm";
import GoalCard from "@/components/GoalCard";
import DonutChart from "@/components/DonutChart";
import CommentSection from "@/components/CommentSection";
import MonthSelector from "@/components/MonthSelector";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { calcSectionStats } from "@/lib/utils";
import useCountUp from "@/lib/useCountUp";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useGoalMerge } from "@/hooks/useGoalMerge";
import { suppressNextToast } from "@/lib/toastSuppress";
import { toast } from "sonner";
import { type GoalData } from "@/types";
import { Plus, ArrowDownAZ, ArrowDownWideNarrow, CalendarDays, Users, Hash, ArrowUpDown, Search } from "lucide-react";

/* ─── Main Section Page ──────────────────────────────────────────────────── */
export default function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionParam } = use(params);
  const section = sectionParam.toUpperCase();
  const searchParams = useSearchParams();
  const { user, isAdmin } = useAuth();
  const permissions = user?.permissions || { canEditGoals: false, canDeleteGoals: false, canCreateGoals: true, canManageMembers: false, canCreateMonths: false };

  const [sectionColor, setSectionColor] = useState("var(--accent)");

  /* Goal highlight from notification deep link */
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null);

  /* Fetch sections and validate */
  useEffect(() => {
    fetch("/api/sections")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sections");
        return res.json();
      })
      .then((data) => {
        const secs = data.sections || [];
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

  /* Delete confirmation state */
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

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
        if (!res.ok) throw new Error("Failed to load goals");
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
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load months");
        return res.json();
      })
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

  /* ─── Goal Highlight from Deep Link ─────────────────────────────────────── */
  useEffect(() => {
    const goalId = searchParams.get("goalId");
    if (!goalId || goals.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggered by URL-driven deep link, not cascading render
    setHighlightGoalId(goalId);

    /* Scroll to the goal element */
    const el = document.getElementById(`goal-${goalId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* Clear highlight after 5.1s (6 pulses × 0.85s) */
    const t = setTimeout(() => {
      setHighlightGoalId(null);
      /* Remove goalId from URL without reload */
      const url = new URL(window.location.href);
      url.searchParams.delete("goalId");
      window.history.replaceState({}, "", url.toString());
    }, 5100);

    return () => clearTimeout(t);
  }, [searchParams, goals]);

  /* ─── Realtime Sync ──────────────────────────────────────────────────────── */
  const { generation, snapshotRef } = useRealtimeSync({
    monthId: monthId || undefined,
    section,
    enabled: !!monthId,
  });

  const fetchSectionConfig = useCallback(() => {
    fetch("/api/sections")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sections");
        return res.json();
      })
      .then((data) => {
        const secs = data.sections || [];
        const found = secs.find((s: { key: string }) => s.key === section);
        if (found) setSectionColor(found.color);
      });
  }, [section]);

  const { getIsNewGoalIds } = useGoalMerge({
    generation,
    snapshotRef,
    setGoals,
    onSectionChanged: fetchSectionConfig,
  });

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
    /* Optimistic: create a temp goal and insert it */
    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const maxGoalNum = goals.reduce((max, g) => Math.max(max, g.goalNumber), 0);
    const optimisticGoal: GoalData = {
      id: tempId,
      name: data.name,
      description: data.description || "",
      goalNumber: maxGoalNum + 1,
      current: data.current || 0,
      target: data.target || 1,
      done: false,
      deadline: data.deadline,
      carriedOver: false,
      section,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      monthId: data.monthId,
      authorId: user?.id || "",
      deadlineSetByAdmin: false,
      comments: [],
      assignments: [],
      steps: [],
    };
    setGoals((prev) => [...prev, optimisticGoal]);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, section }),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      const { goal } = await res.json();
      /* Replace temp with real goal */
      setGoals((prev) =>
        prev.map((g) => (g.id === tempId ? { ...goal, assignments: goal.assignments || [] } : g))
      );
      suppressNextToast();
      return goal?.id || null;
    } catch {
      /* Rollback: remove temp goal */
      setGoals((prev) => prev.filter((g) => g.id !== tempId));
      throw new Error("Failed to create goal");
    }
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
    /* Optimistic: update in place */
    const prevGoal = goals.find((g) => g.id === editingGoal.id);
    setGoals((prev) =>
      prev.map((g) =>
        g.id === editingGoal.id
          ? { ...g, name: data.name, description: data.description, current: data.current, target: data.target, deadline: data.deadline }
          : g
      )
    );
    try {
      const res = await fetch(`/api/goals/${editingGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update goal");
      suppressNextToast();
    } catch {
      /* Rollback */
      if (prevGoal) {
        setGoals((prev) =>
          prev.map((g) => (g.id === editingGoal.id ? prevGoal : g))
        );
      }
      throw new Error("Failed to update goal");
    }
  };

  const handleSaveAssignments = async (goalId: string, assignments: GoalAssignmentData[]) => {
    /* Optimistic: update assignment names/pfps immediately */
    const prevGoal = goals.find((g) => g.id === goalId);
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              assignments: assignments.map((a) => ({
                ...a,
                name: g.assignments.find((ga) => ga.userId === a.userId)?.name || "",
                pfp: g.assignments.find((ga) => ga.userId === a.userId)?.pfp || null,
              })),
            }
          : g
      )
    );
    try {
      const res = await fetch(`/api/goals/${goalId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error("Failed to save");
      suppressNextToast();
    } catch {
      /* Rollback */
      if (prevGoal) {
        setGoals((prev) =>
          prev.map((g) => (g.id === goalId ? prevGoal : g))
        );
      }
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setDeleteGoalId(goalId);
  };

  const confirmDeleteGoal = async () => {
    if (!deleteGoalId) return;
    const goalId = deleteGoalId;
    setDeleteGoalId(null);
    /* Optimistic: remove immediately — rollback via functional updater avoids stale closure */
    let removedGoal: GoalData | undefined;
    setGoals((prev) => {
      removedGoal = prev.find((g) => g.id === goalId);
      return prev.filter((g) => g.id !== goalId);
    });
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete goal");
      suppressNextToast();
      toast.success("Goal deleted");
    } catch {
      /* Rollback: re-insert the removed goal at its original position */
      if (removedGoal) {
        setGoals((prev) => {
          const next = [...prev, removedGoal!];
          next.sort((a, b) => a.goalNumber - b.goalNumber);
          return next;
        });
      }
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
      } else {
        suppressNextToast();
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
      } else {
        suppressNextToast();
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
            style={{ borderTopColor: "transparent", borderRightColor: `${color}40`, borderBottomColor: `${color}40`, borderLeftColor: `${color}40` }}
          />
        </div>
      ) : goals.length === 0 ? (
        <div className="glass rounded-2xl text-center py-20 text-text-muted">
          <Image src="/rina/think.webp" alt="Catarina thinking" width={160} height={160} className="w-24 sm:w-40 h-auto mx-auto mb-5 drop-shadow-sm rounded-2xl" />
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
          aria-live="polite"
          aria-label="Goal cards"
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
                isNew={getIsNewGoalIds().has(goal.id)}
                highlight={highlightGoalId === goal.id}
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
        initialData={editingGoal ? { ...editingGoal, assignments: editingGoal.assignments.map((a) => ({ userId: a.userId, canCheck: a.canCheck, canEdit: a.canEdit })) } : { monthId: monthId || "" }}
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

      {/* ── Delete Goal Confirmation ───────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteGoalId}
        onClose={() => setDeleteGoalId(null)}
        onConfirm={confirmDeleteGoal}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
