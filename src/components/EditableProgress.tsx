"use client";

/**
 * EditableProgress — Inline progress bar with click-to-edit for targets.
 * Displays current/target with animated bar; admins can click to edit values.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { calcPercentage } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { useThemeSafeGraphicColor } from "@/lib/themeSafeColor";

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
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const save = () => {
    const c = Math.max(0, parseInt(draftCurrent) || 0);
    const t = Math.max(1, parseInt(draftTarget) || 1);
    if (c !== current || t !== target) onSave(c, t);
    setEditing(false);
  };

  /* Prevent blade-tabbing between the two number inputs from blur-saving and
   * unmounting the editor before the second field can be reached. */
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (editorRef.current && (!next || !editorRef.current.contains(next))) {
      save();
    }
  };

  const percentage = calcPercentage(current, target);

  /* Accessible variant of the section color for the progress fill. */
  const safeGraphic = useThemeSafeGraphicColor(color);

  if (!canEdit) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ backgroundColor: safeGraphic }}
          />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">{current}/{target}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div ref={editorRef} onBlur={handleBlur} className="flex items-center gap-1.5">
        <input
          ref={ref}
          type="number"
          min={0}
          value={draftCurrent}
          onChange={(e) => setDraftCurrent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          aria-label="Current value"
          className="w-14 text-center text-sm font-bold rounded-lg bg-surface-2 border border-accent px-2 py-1 text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <span className="text-xs text-text-muted">/</span>
        <input
          type="number"
          min={1}
          value={draftTarget}
          onChange={(e) => setDraftTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          aria-label="Target value"
          className="w-14 text-center text-sm rounded-lg bg-surface-2 border border-accent px-2 py-1 text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraftCurrent(String(current)); setDraftTarget(String(target)); setEditing(true); }}
      className="group/prog flex items-center gap-3 cursor-pointer"
      aria-label={`Edit progress: ${current}/${target}`}
    >
      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ backgroundColor: safeGraphic }}
        />
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap group-hover/prog:text-text group-focus-visible/prog:text-text transition-colors">
        {current}/{target}
        <ArrowUpRight size={10} className="inline ml-0.5 opacity-0 group-hover/prog:opacity-100 group-focus-visible/prog:opacity-100 transition-opacity" />
      </span>
    </button>
  );
}
