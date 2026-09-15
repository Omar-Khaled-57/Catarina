"use client";

/**
 * TableEditor — full TeamTable workspace: header (editable name, section chip,
 * accent swatches), the action toolbar, the interactive grid with stickers,
 * plus sticker/PDF modals. All mutations flow through useTableGrid (debounced
 * autosave); read-only members get a clean view-only canvas.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoveLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTableGrid } from "@/hooks/useTableGrid";
import {
  insertRow,
  insertCol,
  deleteRow,
  deleteCol,
  mergeSelection,
  splitCell,
  type GridState,
} from "@/lib/table/grid";
import TableGrid, { type GridSelection } from "./TableGrid";
import TableToolbar from "./TableToolbar";
import StickerLayer from "./StickerLayer";
import StickerPicker from "./StickerPicker";
import ExportPDFModal from "./ExportPDFModal";

const ACCENT_CHOICES = ["#00E8A2", "#7C3AED", "#3B82F6", "#F59E0B", "#FF4D6A"];

interface Props {
  tableId: string;
  sectionMeta: Record<string, string>;
}

export default function TableEditor({ tableId, sectionMeta }: Props) {
  const { user, isAdmin } = useAuth();
  const {
    doc,
    loading,
    loadError,
    isSaving,
    saveError,
    lastSavedAt,
    applyGrid,
    setColor,
    toggleDateMode,
    rename,
    addSticker,
    updateSticker,
    removeSticker,
  } = useTableGrid(tableId);

  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const sectionLabel = doc ? (sectionMeta[doc.section] ?? doc.section) : tableId;
  const canWrite = useMemo(() => {
    if (!doc || !user) return false;
    if (isAdmin) return true;
    return !!user.permissions?.canManageTables && user.sections?.includes(doc.section);
  }, [doc, user, isAdmin]);

  const selectionArea =
    selection != null
      ? (selection.r2 - selection.r1 + 1) * (selection.c2 - selection.c1 + 1)
      : 0;

  const canMerge =
    !!selection && selectionArea >= 2 && doc != null;
  const canSplit = useMemo(() => {
    if (!selection || !doc) return false;
    const cell = doc.grid.rows[selection.r1]?.[selection.c1];
    return !!cell && (cell.rs > 1 || cell.cs > 1) && selectionArea === 1;
  }, [selection, doc, selectionArea]);

  const canModifyRows =
    !!doc &&
    doc.grid.cols < 200 &&
    doc.grid.rows.length < 200;

  const handleMerge = () => {
    if (!selection || !doc) return;
    applyGrid((g) => mergeSelection(g, selection.r1, selection.c1, selection.r2, selection.c2));
    setSelection(null);
    toast.success("Merged");
  };

  const handleSplit = () => {
    if (!selection || !doc) return;
    applyGrid((g) => splitCell(g, selection.r1, selection.c1));
    setSelection(null);
    toast.success("Split");
  };

  const withGrid = (op: (g: GridState) => GridState, msg: string) => {
    applyGrid(op);
    toast.success(msg);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="sr-only">Loading table…</span>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-text">{loadError ?? "Table not found"}</p>
        <Link
          href="/tools/tables"
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← Back to all tables
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Link href="/tools/tables" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
          <MoveLeft size={15} /> All tables
        </Link>
        <span aria-hidden="true">/</span>
        <span>{sectionLabel}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={doc.name}
          onChange={(e) => rename(e.target.value)}
          disabled={!canWrite}
          aria-label="Table name"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-2xl font-bold tracking-tight text-text outline-none transition-colors focus:bg-surface-2/60 disabled:opacity-80 sm:text-3xl"
        />
        <span
          className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1 ring-inset"
          style={{
            color: doc.color,
            background: `color-mix(in srgb, ${doc.color} 14%, transparent)`,
            borderColor: doc.color,
          }}
        >
          {sectionLabel}
        </span>
        {canWrite && (
          <div className="ml-auto flex items-center gap-3" role="group" aria-label="Table accent color">
            {ACCENT_CHOICES.map((color) => (
              <button
                key={color}
                type="button"
                className="h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-[var(--color-bg)] transition-transform hover:scale-110"
                style={{
                  background: color,
                  boxShadow:
                    doc.color === color
                      ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${color}`
                      : undefined,
                }}
                aria-pressed={doc.color === color}
                aria-label={`Accent ${color}`}
                onClick={() => setColor(color)}
              />
            ))}
          </div>
        )}
      </div>

      {!canWrite && (
        <p className="rounded-xl border border-border/60 bg-surface-2/40 px-4 py-2.5 text-sm text-text-muted">
          View only — you can read this table. Ask a {sectionLabel} writer to make changes.
        </p>
      )}

      <TableToolbar
        canWrite={canWrite}
        isDateBased={doc.isDateBased}
        saveState={{ isSaving, error: saveError, lastSavedAt }}
        hasSelection={selection != null}
        canMerge={canMerge}
        canSplit={canSplit}
        canModifyRows={canModifyRows}
        onAddRow={() => withGrid((g) => insertRow(g, g.rows.length - 1), "Row added")}
        onAddCol={() => withGrid((g) => insertCol(g, g.cols - 1), "Column added")}
        onDeleteRow={() => {
          if (!selection) return;
          withGrid((g) => deleteRow(g, selection.r1), "Row deleted");
          setSelection(null);
        }}
        onDeleteCol={() => {
          if (!selection) return;
          withGrid((g) => deleteCol(g, selection.c1), "Column deleted");
          setSelection(null);
        }}
        onMerge={handleMerge}
        onSplit={handleSplit}
        onToggleDateMode={() => toggleDateMode()}
        onAddSticker={() => setPickerOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      {/* Canvas */}
      <div ref={canvasRef} className="table-grid-scroll">
        <div className="w-max min-w-full">
          <TableGrid
            grid={doc.grid}
            canWrite={canWrite}
            isDateBased={doc.isDateBased}
            accent={doc.color}
            onApply={applyGrid}
            selection={selection}
            onSelectionChange={setSelection}
          />
        </div>
        <StickerLayer
          stickers={doc.stickers}
          canWrite={canWrite}
          parentRef={canvasRef}
          onUpdate={updateSticker}
          onRemove={removeSticker}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        <span aria-hidden="true">
          Drag across cells, press <b>Merge</b> · click a merged cell (<b>Split</b>) ·{" "}
          <b>double-click</b> a cell to type
        </span>
        {canWrite && (
          <span>
            Click a sticker to cycle <i>play → pause → frame 2 → play</i>
          </span>
        )}
      </div>

      <StickerPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addSticker}
      />
      <ExportPDFModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        doc={doc}
      />
    </div>
  );
}