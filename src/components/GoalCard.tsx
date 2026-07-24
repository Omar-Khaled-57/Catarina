"use client";

/**
 * GoalCard — Card-based goal with editable progress, steps checklist,
 * and colorful notes area. Replaces the old table row.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type GoalData } from "@/components/GoalRow";
import { deadlineStatus, formatDateShort, calcPercentage, getDefaultPfp } from "@/lib/utils";
import {
  Check,
  Pencil,
  Trash2,
  MessageSquare,
  Plus,
  GripVertical,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Calendar,
  ArrowUpRight,
} from "lucide-react";

/* ─── Section Prefix Map (fallback) ────────────────────────────────────────── */
function getSectionPrefix(section: string, prefixMap?: Record<string, string>): string {
  if (prefixMap?.[section]) return prefixMap[section];
  return section.slice(0, 3).toUpperCase();
}
function EditableProgress({
  current,
  target,
  color,
  canEdit,
  onSave,
}: {
  current: number;
  target: number;
  color: string;
  canEdit: boolean;
  onSave: (current: number, target: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftCurrent, setDraftCurrent] = useState(String(current));
  const [draftTarget, setDraftTarget] = useState(String(target));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const save = () => {
    const c = Math.max(0, parseInt(draftCurrent) || 0);
    const t = Math.max(1, parseInt(draftTarget) || 1);
    if (c !== current || t !== target) onSave(c, t);
    setEditing(false);
  };

  const percentage = calcPercentage(current, target);

  if (!canEdit) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ backgroundColor: color }}
          />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">{current}/{target}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={ref}
          type="number"
          min={0}
          value={draftCurrent}
          onChange={(e) => setDraftCurrent(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-14 text-center text-sm font-bold rounded-lg bg-surface-2 border border-accent px-2 py-1 text-text focus:outline-none"
        />
        <span className="text-xs text-text-muted">/</span>
        <input
          type="number"
          min={1}
          value={draftTarget}
          onChange={(e) => setDraftTarget(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-14 text-center text-sm rounded-lg bg-surface-2 border border-accent px-2 py-1 text-text focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraftCurrent(String(current)); setDraftTarget(String(target)); setEditing(true); }}
      className="group/prog flex items-center gap-3 cursor-pointer"
    >
      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap group-hover/prog:text-text transition-colors">
        {current}/{target}
        <ArrowUpRight size={10} className="inline ml-0.5 opacity-0 group-hover/prog:opacity-100 transition-opacity" />
      </span>
    </button>
  );
}

/* ─── Steps Checklist ────────────────────────────────────────────────────── */
function StepsChecklist({
  goalId,
  steps,
  color,
  canToggle,
  onStepsChange,
  onAllDone,
}: {
  goalId: string;
  steps: GoalData["steps"];
  color: string;
  canToggle: boolean;
  onStepsChange: (steps: GoalData["steps"]) => void;
  onAllDone: () => void;
}) {
  const [isOpen, setIsOpen] = useState(steps.length > 0);
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const doneCount = steps.filter((s) => s.done).length;

  const toggleStep = async (stepId: string, done: boolean) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, done: !done } : s));
    onStepsChange(updated);
    await fetch(`/api/steps/${stepId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !done }),
    });
    /* Auto-complete goal if all steps are now done */
    if (updated.length > 0 && updated.every((s) => s.done)) {
      onAllDone();
    }
  };

  const addStep = async () => {
    if (!newText.trim()) return;
    const res = await fetch(`/api/goals/${goalId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText.trim(), order: steps.length }),
    });
    const { step } = await res.json();
    onStepsChange([...steps, step]);
    setNewText("");
    setIsAdding(false);
  };

  const deleteStep = async (stepId: string) => {
    onStepsChange(steps.filter((s) => s.id !== stepId));
    await fetch(`/api/steps/${stepId}`, { method: "DELETE" });
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text transition-colors mb-2"
      >
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <ListChecks size={13} />
        <span>Steps</span>
        {steps.length > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {doneCount}/{steps.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pl-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 group/step rounded-lg px-2 py-1.5 hover:bg-surface-2/50 transition-colors"
                >
                  {canToggle ? (
                    <button
                      onClick={() => toggleStep(step.id, step.done)}
                      className="shrink-0"
                    >
                      <div
                        className={`h-4 w-4 rounded-md border-2 flex items-center justify-center transition-all ${
                          step.done
                            ? "border-transparent"
                            : "border-text-muted/30 hover:border-accent"
                        }`}
                        style={step.done ? { backgroundColor: color, borderColor: color } : {}}
                      >
                        {step.done && <Check size={10} strokeWidth={3} className="text-bg" />}
                      </div>
                    </button>
                  ) : (
                    <div
                      className={`h-4 w-4 rounded-md border-2 flex items-center justify-center ${
                        step.done ? "" : "border-text-muted/30"
                      }`}
                      style={step.done ? { backgroundColor: color, borderColor: color } : {}}
                    >
                      {step.done && <Check size={10} strokeWidth={3} className="text-bg" />}
                    </div>
                  )}
                  <span
                    className={`text-xs flex-1 ${
                      step.done ? "line-through text-text-muted" : "text-text"
                    }`}
                  >
                    {step.text}
                  </span>
                  {canToggle && (
                    <button
                      onClick={() => deleteStep(step.id)}
                      className="opacity-0 group-hover/step:opacity-100 text-text-muted hover:text-danger transition-all text-[10px]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {isAdding ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="h-4 w-4 rounded-md border-2 border-text-muted/30 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addStep(); if (e.key === "Escape") { setIsAdding(false); setNewText(""); } }}
                    onBlur={() => { if (!newText.trim()) setIsAdding(false); }}
                    placeholder="Step description..."
                    className="flex-1 text-xs bg-transparent border-b border-accent/50 text-text placeholder:text-text-muted/40 focus:outline-none py-0.5"
                  />
                </div>
              ) : canToggle ? (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text px-2 py-1.5 rounded-lg hover:bg-surface-2/50 transition-colors"
                >
                  <Plus size={12} />
                  Add step
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
}) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [localSteps, setLocalSteps] = useState(goal.steps);
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`glass rounded-2xl overflow-hidden transition-all relative ${
        deadline === "overdue" && !goal.done ? "ring-1 ring-danger/30" : ""
      }`}
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
                    <img src={a.pfp} alt={a.name} className="h-full w-full object-cover" />
                  ) : getDefaultPfp(goal.section) ? (
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
