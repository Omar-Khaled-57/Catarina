"use client";

/**
 * StepsChecklist — Collapsible checklist of sub-steps for a goal.
 * Supports adding, deleting, and toggling steps inline.
 * Auto-completes the parent goal when all steps are done.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type GoalData } from "@/types";
import { Check, Plus, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface StepsChecklistProps {
  goalId: string;
  steps: GoalData["steps"];
  color: string;
  canToggle: boolean;
  onStepsChange: (steps: GoalData["steps"]) => void;
  onAllDone: () => void;
}

export default function StepsChecklist({
  goalId,
  steps,
  color,
  canToggle,
  onStepsChange,
  onAllDone,
}: StepsChecklistProps) {
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
    if (!res.ok) {
      toast.error("Failed to add step");
      return;
    }
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
                      role="checkbox"
                      aria-checked={step.done}
                      aria-label={step.done ? `Uncheck step: ${step.text}` : `Check step: ${step.text}`}
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
                      role="img"
                      aria-label={step.done ? `Step completed: ${step.text}` : `Step pending: ${step.text}`}
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
                      aria-label={`Delete step: ${step.text}`}
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
