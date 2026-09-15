"use client";

/**
 * TableToolbar — desktop action bar for the table editor. Mirrors the
 * prototype: add/delete rows & columns, Merge / Split (disabled until the
 * selection makes sense), date-mode toggle, stickers, and PDF export.
 */

import {
  CalendarDays,
  Columns,
  Download,
  Rows,
  Smile,
  Sticker,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveState {
  isSaving: boolean;
  error: string | null;
  lastSavedAt: number | null;
}

interface Props {
  canWrite: boolean;
  isDateBased: boolean;
  saveState: SaveState;
  hasSelection: boolean;
  canMerge: boolean;
  canSplit: boolean;
  canModifyRows: boolean;
  onAddRow: () => void;
  onAddCol: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onToggleDateMode: () => void;
  onAddSticker: () => void;
  onExport: () => void;
}

function SavePill({ saveState }: { saveState: SaveState }) {
  if (!saveState.error && !saveState.isSaving && saveState.lastSavedAt === null)
    return null;
  if (saveState.error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-[11px] font-bold text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
        Retrying…
      </span>
    );
  }
  if (saveState.isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-bold text-text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-bold text-text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Saved
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-surface-2/50 px-2.5 py-2 text-xs font-semibold text-text transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 sm:px-3";

export default function TableToolbar({
  canWrite,
  isDateBased,
  saveState,
  hasSelection,
  canMerge,
  canSplit,
  canModifyRows,
  onAddRow,
  onAddCol,
  onDeleteRow,
  onDeleteCol,
  onMerge,
  onSplit,
  onToggleDateMode,
  onAddSticker,
  onExport,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface/80 p-1.5 shadow-sm backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-2">
      {/* Insert / delete rows & columns — tidy 2×2 block on mobile */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        <button
          type="button"
          className={cn(btnBase, "w-full sm:w-auto")}
          onClick={onAddRow}
          disabled={!canWrite || !canModifyRows}
          title="Add a row at the bottom"
        >
          <Rows size={14} className="text-accent" /> + Row
        </button>
        <button
          type="button"
          className={cn(btnBase, "w-full sm:w-auto")}
          onClick={onAddCol}
          disabled={!canWrite || !canModifyRows}
          title="Add a column at the right"
        >
          <Columns size={14} className="text-accent" /> + Column
        </button>
        <button
          type="button"
          className={cn(btnBase, "w-full text-danger sm:w-auto")}
          onClick={onDeleteRow}
          disabled={!canWrite || !hasSelection}
          title="Delete the selected row"
        >
          <Trash2 size={14} /> − Row
        </button>
        <button
          type="button"
          className={cn(btnBase, "w-full text-danger sm:w-auto")}
          onClick={onDeleteCol}
          disabled={!canWrite || !hasSelection}
          title="Delete the selected column"
        >
          <Trash2 size={14} /> − Column
        </button>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      {/* Merge / Split / date mode — single even row on mobile */}
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        <button
          type="button"
          className={cn(btnBase, "w-full sm:w-auto")}
          onClick={onMerge}
          disabled={!canWrite || !canMerge}
          title="Merge the selected cells (2+ cells)"
        >
          Merge
        </button>
        <button
          type="button"
          className={cn(btnBase, "w-full sm:w-auto")}
          onClick={onSplit}
          disabled={!canWrite || !canSplit}
          title="Split the selected merged cell"
        >
          Split
        </button>
        <button
          type="button"
          className={cn(
            btnBase,
            "w-full sm:w-auto",
            isDateBased && "border-accent/50 bg-accent/15 text-accent",
          )}
          onClick={onToggleDateMode}
          disabled={!canWrite}
          aria-pressed={isDateBased}
          title="Toggle date mode — highlights today's column or row"
        >
          <CalendarDays size={14} /> {isDateBased ? "Dates on" : "Dates off"}
        </button>
      </div>

      {/* Sticker / PDF — full-width pair on mobile; the save pill only shows
          on md+ so the mobile toolbar stays uncluttered. */}
      <div className="flex items-center gap-1.5 sm:ml-auto sm:gap-2">
        <div className="hidden sm:contents">
          <SavePill saveState={saveState} />
        </div>
        <button
          type="button"
          className={cn(btnBase, "flex-1 sm:flex-none")}
          onClick={onAddSticker}
          disabled={!canWrite}
          title="Add a sticker"
        >
          {isDateBased ? <Smile size={14} /> : <Sticker size={14} />} Sticker
        </button>
        <button
          type="button"
          className={cn(btnBase, "flex-1 sm:flex-none")}
          onClick={onExport}
          title="Export this table as a themed PDF"
        >
          <Download size={14} /> PDF
        </button>
      </div>
    </div>
  );
}