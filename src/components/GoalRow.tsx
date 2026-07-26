"use client";

/**
 * GoalRow — Individual goal item with checkbox, progress, and deadline.
 * Supports toggling done status, inline editing (admin), and viewing comments.
 */

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { deadlineStatus, formatDateShort, calcPercentage, getDefaultPfp } from "@/lib/utils";
import { type GoalData } from "@/types";
import { Check, Pencil, Trash2, MessageSquare } from "lucide-react";

export type { GoalData } from "@/types";

interface GoalRowProps {
  goal: GoalData;
  isAdmin: boolean;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (goal: GoalData) => void;
  onDelete: (id: string) => void;
  onComment: (goalId: string) => void;
}

export default function GoalRow({
  goal,
  isAdmin,
  onToggle,
  onEdit,
  onDelete,
  onComment,
}: GoalRowProps) {
  const [isToggling, setIsToggling] = useState(false);
  const deadline = deadlineStatus(goal.deadline, goal.done);
  const percentage = calcPercentage(goal.current, goal.target);
  const color = "var(--accent)";

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(goal.id, !goal.done);
    setIsToggling(false);
  };

  return (
    <div
      className={`glass rounded-xl p-4 transition-all ${
        goal.done ? "opacity-60" : ""
      } ${deadline === "overdue" ? "border-danger/30" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
            goal.done
              ? "bg-accent border-accent text-bg"
              : "border-text-muted hover:border-accent"
          }`}
          aria-label={goal.done ? "Mark as incomplete" : "Mark as done"}
        >
          {goal.done && (
            <Check size={12} strokeWidth={3} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4
                className={`font-semibold text-sm ${
                  goal.done
                    ? "line-through text-text-muted"
                    : "text-text"
                }`}
              >
                {goal.name}
              </h4>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                {goal.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {goal.carriedOver && (
                <Badge variant="warning" className="text-[10px]">
                  Carried Over
                </Badge>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => onEdit(goal)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                    aria-label="Edit goal"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(goal.id)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              {/* Comment button */}
              <button
                onClick={() => onComment(goal.id)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors relative"
                aria-label="View comments"
              >
                <MessageSquare size={14} />
                {goal.comments.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-bg flex items-center justify-center">
                    {goal.comments.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-2.5 flex items-center gap-3">
            <ProgressBar
              value={percentage}
              color={goal.done ? "var(--accent)" : color}
              height="h-1.5"
              className="flex-1"
            />
            <span className="text-xs text-text-muted whitespace-nowrap">
              {goal.current}/{goal.target}
            </span>
          </div>

          {/* Deadline + Assignees */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs ${
                deadline === "overdue"
                  ? "text-danger font-semibold"
                  : deadline === "urgent"
                  ? "text-warning font-semibold"
                  : "text-text-muted"
              }`}
            >
              {deadline === "overdue"
                ? "Overdue"
                : deadline === "urgent"
                ? "Due soon"
                : formatDateShort(goal.deadline)}
            </span>
            {percentage === 100 && (
              <Badge variant="success">Complete</Badge>
            )}
            {goal.assignments.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                {goal.assignments.map((a) => (
                  <div
                    key={a.userId}
                    className="h-5 w-5 rounded-full overflow-hidden border border-border shrink-0"
                    title={`${a.name}${a.canCheck ? " (check)" : ""}${a.canEdit ? " (edit)" : ""}`}
                  >
                    {a.pfp ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.pfp} alt={a.name} className="h-full w-full object-cover" />
                    ) : getDefaultPfp(goal.section) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getDefaultPfp(goal.section)!} alt={a.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-surface-2 flex items-center justify-center text-[8px] font-bold text-text-muted">
                        {a.name.charAt(0)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
