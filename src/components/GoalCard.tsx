"use client";

/**
 * GoalCard — Card-based goal with editable progress, steps checklist,
 * and colorful notes area. Replaces the old table row.
 */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { type GoalData } from "@/types";
import EditableProgress from "@/components/EditableProgress";
import StepsChecklist from "@/components/StepsChecklist";
import { deadlineStatus, formatDateShort, getDefaultPfp } from "@/lib/utils";
import {
  Check,
  Pencil,
  Trash2,
  MessageSquare,
  Calendar,
} from "lucide-react";

/* ─── Section Prefix Map (fallback) ────────────────────────────────────────── */
function getSectionPrefix(section: string, prefixMap?: Record<string, string>): string {
  if (prefixMap?.[section]) return prefixMap[section];
  return section.slice(0, 3).toUpperCase();
}

/* ─── GoalCard ───────────────────────────────────────────────────────────── */
export default function GoalCard({
  goal,
  userId,
  isAdmin,
  permissions,
  color,
  sectionPrefixes,
  onToggle,
  onEdit,
  onDelete,
  onComment,
  onProgressChange,
  onAutoComplete,
  isNew = false,
  highlight = false,
}: {
  goal: GoalData;
  userId: string;
  isAdmin: boolean;
  permissions: { canEditGoals: boolean; canDeleteGoals: boolean };
  color: string;
  sectionPrefixes?: Record<string, string>;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (goal: GoalData) => void;
  onDelete: (id: string) => void;
  onComment: (goalId: string) => void;
  onProgressChange: (goalId: string, current: number, target: number) => void;
  onAutoComplete: (goalId: string) => void;
  isNew?: boolean;
  highlight?: boolean;
}) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [localSteps, setLocalSteps] = useState(goal.steps);
  const prefersReducedMotion = useReducedMotion();
  const deadline = deadlineStatus(goal.deadline, goal.done);

  /* Permission check */
  let canToggle = false;
  let canEdit = false;
  if (isAdmin) {
    canToggle = true;
    canEdit = true;
  } else {
    const assignment = goal.assignments.find((a) => a.userId === userId);
    if (assignment) {
      canToggle = assignment.canCheck;
      canEdit = assignment.canEdit;
    } else if (permissions.canEditGoals) {
      canToggle = true;
      canEdit = true;
    }
  }

  const handleToggle = () => {
    setIsPulsing(true);
    onToggle(goal.id, !goal.done);
    setTimeout(() => setIsPulsing(false), 400);
  };

  const handleProgressSave = (current: number, target: number) => {
    onProgressChange(goal.id, current, target);
  };

  const prefix = getSectionPrefix(goal.section, sectionPrefixes);

  return (
    <motion.div
      id={`goal-${goal.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isNew && !prefersReducedMotion
          ? [`0 0 0px ${color}00`, `0 0 24px ${color}35`, `0 0 0px ${color}00`]
          : `0 0 0px ${color}00`,
      }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={
        isNew && !prefersReducedMotion
          ? { boxShadow: { duration: 2, ease: "easeOut" }, default: { type: "spring", stiffness: 350, damping: 30 } }
          : { type: "spring", stiffness: 350, damping: 30 }
      }
      style={highlight ? { "--section-color": deadline === "overdue" && !goal.done ? "rgba(255,77,106,0.55)" : deadline === "urgent" && !goal.done ? "rgba(255,184,48,0.55)" : `${color}80` } as React.CSSProperties : undefined}
      className={`glass rounded-2xl overflow-hidden transition-all relative ${
        deadline === "overdue" && !goal.done ? "ring-1 ring-danger/30" : ""
      } ${highlight ? "goal-highlight" : ""}`}
    >
      {/* ── Color Accent Bar ──────────────────────────────────────────── */}
      <div className="h-1 w-full" style={{ backgroundColor: color, opacity: 0.7 }} />

      {/* ── Complete Stamp (45deg animated overlay) ──────────────────────── */}
      <AnimatePresence>
        {goal.done && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 2.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.8 }}
          >
            <div
              className="border-4 rounded-xl px-6 py-2 -rotate-45 select-none"
              style={{
                borderColor: color,
                color,
                backgroundColor: `${color}10`,
              }}
            >
              <span className="text-2xl font-black tracking-widest uppercase" style={{ textShadow: `0 0 20px ${color}40` }}>
                COMPLETE
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`p-5 transition-opacity duration-300 ${goal.done ? "opacity-40" : ""}`}>
        {/* ── Goal ID Badge ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-md text-[10px] font-black tracking-tight"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {prefix}-{String(goal.goalNumber).padStart(3, "0")}
          </span>
        </div>

        {/* ── Header Row: Checkbox + Title + Actions ──────────────────── */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={handleToggle}
            disabled={!canToggle}
            role="checkbox"
            aria-checked={goal.done}
            aria-label={goal.done ? "Mark as incomplete" : "Mark as done"}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
              goal.done
                ? "border-transparent text-bg"
                : "border-text-muted/40 hover:border-accent"
            } ${isPulsing ? "checkbox-pulse" : ""} ${
              !canToggle ? "opacity-30 cursor-not-allowed" : ""
            }`}
            style={goal.done ? { backgroundColor: color } : {}}
          >
            {goal.done && <Check size={11} strokeWidth={3.5} />}
          </button>

          {/* Title + Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {goal.carriedOver && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">
                  Carried Over
                </span>
              )}
              <h3
                className={`font-bold text-[15px] leading-snug ${
                  goal.done ? "line-through text-text-muted" : "text-text"
                }`}
              >
                {goal.name}
              </h3>
            </div>
            {goal.description && (
              <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Comment button with count badge */}
            <button
              onClick={() => onComment(goal.id)}
              className="relative rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              aria-label="Comments"
            >
              <MessageSquare size={14} />
              {goal.comments.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-bg flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  {goal.comments.length}
                </span>
              )}
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(goal)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                aria-label="Edit goal"
              >
                <Pencil size={14} />
              </button>
            )}
            {permissions.canDeleteGoals && (
              <button
                onClick={() => onDelete(goal.id)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                aria-label="Delete goal"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Editable Progress ───────────────────────────────────────── */}
        <div className="mt-4">
          <EditableProgress
            current={goal.current}
            target={goal.target}
            color={color}
            canEdit={canEdit}
            onSave={handleProgressSave}
          />
        </div>

        {/* ── Steps Checklist ─────────────────────────────────────────── */}
        <StepsChecklist
          goalId={goal.id}
          steps={localSteps}
          color={color}
          canToggle={canToggle}
          onStepsChange={setLocalSteps}
          onAllDone={() => onAutoComplete(goal.id)}
        />

        {/* ── Footer: Deadline + Assignees ────────────────────────────── */}
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
          {/* Deadline badge */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${
              deadline === "overdue"
                ? "bg-danger/10 text-danger"
                : deadline === "urgent"
                ? "bg-warning/10 text-warning"
                : "bg-surface-2 text-text-muted"
            }`}
          >
            <Calendar size={11} />
            {deadline === "overdue"
              ? "Overdue"
              : deadline === "urgent"
              ? "Due soon"
              : formatDateShort(goal.deadline)}
          </span>

          {/* Assignees — push right */}
          {goal.assignments.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              {goal.assignments.slice(0, 4).map((a) => (
                <div
                  key={a.userId}
                  className="h-6 w-6 rounded-full overflow-hidden border-2 border-bg shrink-0 -ml-1 first:ml-0"
                  title={`${a.name}${a.canCheck ? " (check)" : ""}${a.canEdit ? " (edit)" : ""}`}
                  style={{ borderColor: `${color}40` }}
                >
                  {a.pfp ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.pfp} alt={a.name} className="h-full w-full object-cover" />
                  ) : getDefaultPfp(goal.section) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getDefaultPfp(goal.section)!} alt={a.name} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full flex items-center justify-center text-[9px] font-bold text-bg"
                      style={{ backgroundColor: color }}
                    >
                      {a.name.charAt(0)}
                    </div>
                  )}
                </div>
              ))}
              {goal.assignments.length > 4 && (
                <span className="text-[10px] text-text-muted ml-1">
                  +{goal.assignments.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
