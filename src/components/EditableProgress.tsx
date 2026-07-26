"use client";

/**
 * EditableProgress — Inline progress bar with click-to-edit for targets.
 * Displays current/target with animated bar; admins can click to edit values.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { calcPercentage } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface EditableProgressProps {
  current: number;
  target: number;
  color: string;
  canEdit: boolean;
  onSave: (current: number, target: number) => void;
}

export default function EditableProgress({
  current,
  target,
  color,
  canEdit,
  onSave,
}: EditableProgressProps) {
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
