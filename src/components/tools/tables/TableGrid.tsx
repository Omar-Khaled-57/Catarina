"use client";

/**
 * TableGrid — the interactive TeamTable canvas.
 *
 * - Drag a rectangle to select (then Merge in the toolbar).
 * - Click a merged cell to select it (then Split).
 * - Double-click a cell to edit its value.
 * - Stand on a column's right edge or a row's bottom edge (arrow cursor,
 *   like Office tables): a quick TAP selects that whole column/row, HOLD then
 *   drag RESIZES it. Resize stops on release (pointer capture, mouse or
 *   touch), Escape / pointer-cancel aborts and restores the size, and a
 *   double-click on the edge resets that row/column back to automatic.
 *   Resized widths/heights persist in grid.sizes.
 * - Today strip: when date mode is on and cells carry YYYY-MM-DD values, the
 *   matching row/column strip is highlighted with the table's accent.
 *
 * Grid maths stays in src/lib/table/grid.ts — this component only renders and
 * forwards edits/selection.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridState } from "@/lib/table/grid";
import { resetSize, setCell, setSize } from "@/lib/table/grid";
import { detectDateAxis, todayIndex } from "@/lib/table/date";

export interface GridSelection {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface GridBand {
  axis: "col" | "row";
  index: number;
}

interface Props {
  grid: GridState;
  canWrite: boolean;
  isDateBased: boolean;
  accent: string;
  onApply: (op: (g: GridState) => GridState) => void;
  selection: GridSelection | null;
  onSelectionChange: (sel: GridSelection | null) => void;
}

function rectOf(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): GridSelection {
  return {
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.max(r1, r2),
    c2: Math.max(c1, c2),
  };
}

function inRect(sel: GridSelection, r: number, c: number): boolean {
  return r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2;
}

/* A quick tap on an edge selects (release inside slop + hold window); to
   resize you drag past the slop or keep the press held past HOLD_MS. */
const CLICK_SLOP_PX = 6;
const HOLD_MS = 250;

type EdgeKind = "col" | "col-last" | "row" | "row-last";

export default function TableGrid({
  grid,
  canWrite,
  isDateBased,
  accent,
  onApply,
  selection,
  onSelectionChange,
}: Props) {
  const dragRef = useRef<{ r: number; c: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const gestureRef = useRef<{
    type: "col" | "row";
    index: number;
    startX: number;
    startY: number;
    base: number;
    engaged: boolean;
    startedAt: number;
    original: number | null;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPx = useRef<number | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [band, setBand] = useState<GridBand | null>(null);
  const [pulling, setPulling] = useState<GridBand | null>(null);
  const bandRef = useRef<GridBand | null>(null);

  const stringGrid = useMemo(
    () => grid.rows.map((row) => row.map((c) => c?.v ?? null)),
    [grid],
  );
  const axis = useMemo(
    () => (isDateBased ? detectDateAxis(stringGrid, grid.cols) : null),
    [isDateBased, stringGrid, grid.cols],
  );
  const todayIdx = useMemo(
    () => (axis ? todayIndex(stringGrid, grid.cols, axis) : -1),
    [axis, stringGrid, grid.cols],
  );

  /* Resize gesture lives on the EDGE STRIPS with pointer capture, so a release
     ALWAYS ends the resize (mouse or touch, even off-window). A quick tap
     selects the row/column; you must HOLD (or drag past the slop) to resize;
     Escape / pointer-cancel aborts and restores the original size. The rAF
     loop applies the latest pending size once per frame. */
  const flush = () => {
    rafRef.current = null;
    if (pendingPx.current === null) return;
    const px = pendingPx.current;
    pendingPx.current = null;
    const g = gestureRef.current;
    if (!g) return;
    onApply((state) =>
      setSize(state, g.type === "col" ? "cols" : "rows", g.index, px),
    );
  };

  const stopGesture = useCallback(
    (restore: boolean) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      pendingPx.current = null;
      const g = gestureRef.current;
      gestureRef.current = null;
      setPulling(null);
      if (g && restore && g.engaged) {
        const axis = g.type === "col" ? "cols" : "rows";
        onApply((state) =>
          g.original == null
            ? resetSize(state, axis, g.index)
            : setSize(state, axis, g.index, g.original),
        );
      }
    },
    [onApply],
  );

  /* Escape aborts an active resize mid-drag, or clears the current selection
     when nothing is being resized. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (gestureRef.current) {
        stopGesture(true);
        return;
      }
      bandRef.current = null;
      setBand(null);
      onSelectionChange(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopGesture, onSelectionChange]);

  const startEdit = (r: number, c: number, initial: string) => {
    setEditingValue(initial);
    setEditing({ r, c });
  };

  const commitEdit = () => {
    if (!editing) return;
    const { r, c } = editing;
    setEditing(null);
    onApply((g) => setCell(g, r, c, editingValue));
  };

  const rows = grid.rows;
  const nRows = rows.length;
  const nCols = grid.cols;
  const colSize = grid.sizes?.cols ?? [];
  const rowSize = grid.sizes?.rows ?? [];

  /* Measure the ACTUAL rendered size of a row/column straight from the DOM,
     used ONCE as the resize base at press time. Auto table layout renegotiates
     widths every frame (min-width:100% slack, content floors, merged spans),
     so feeding measured values back into the pointer delta each move causes
     jumps — we only read them here and then track the pointer with pure
     deltas, locking the resized column to the exact px (see max-width below)
     so the browser can't redistribute it. */
  const measureSize = (
    type: "col" | "row",
    index: number,
  ): number | null => {
    const table = tableRef.current;
    const tbody = table?.querySelector("tbody");
    if (!tbody) return null;
    const trs = Array.from(tbody.children) as HTMLTableRowElement[];
    if (type === "row") {
      const tr = trs[index];
      return tr ? tr.getBoundingClientRect().height : null;
    }
    // Widest true single-column cell in this column (matches how auto layout
    // resolves the used width; merged spans only kick in as a last resort).
    let best = 0;
    for (const tr of trs) {
      let offset = 0;
      for (const td of Array.from(tr.cells)) {
        if (td.colSpan === 1 && offset === index) {
          const w = td.getBoundingClientRect().width;
          if (w > best) best = w;
          break;
        }
        offset += td.colSpan;
        if (offset > index) break;
      }
    }
    if (best > 0) return best;
    // Column is only touched by merged spans — apportion the covering cell.
    for (const tr of trs) {
      let offset = 0;
      for (const td of Array.from(tr.cells)) {
        if (offset <= index && index < offset + td.colSpan) {
          return td.getBoundingClientRect().width / td.colSpan;
        }
        offset += td.colSpan;
        if (offset > index) break;
      }
    }
    return null;
  };

  const startResize = (
    e: React.PointerEvent<HTMLElement>,
    kind: EdgeKind,
    index: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const type = kind === "col" || kind === "col-last" ? "col" : "row";
    const sizeIndex =
      kind === "col-last" ? nCols - 1 : kind === "row-last" ? nRows - 1 : index;
    const original =
      type === "col" ? (colSize[sizeIndex] ?? null) : (rowSize[sizeIndex] ?? null);
    // Capture the pointer so the release ALWAYS ends the resize, including on
    // touch and when the cursor leaves the window mid-drag.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gestureRef.current = {
      type,
      index: sizeIndex,
      startX: e.clientX,
      startY: e.clientY,
      base: measureSize(type, sizeIndex) ?? 120,
      engaged: false,
      startedAt: performance.now(),
      original,
    };
  };

  const handleMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g) return;
    if (!g.engaged) {
      const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
      const elapsed = performance.now() - g.startedAt;
      // Quick taps (small movement, released early) stay clicks → select.
      // Resize engages only on a deliberate drag or after holding a beat,
      // so a plain press can never start resizing by itself.
      if (dist < CLICK_SLOP_PX && elapsed < HOLD_MS) return;
      if (dist < 2) return; // holding still — stay armed, don't resize yet
      g.engaged = true;
      setPulling({ axis: g.type, index: g.index });
    }
    // Pure pointer tracking vs. the press-time base: the resized edge moves
    // exactly with the cursor (no feedback from the negotiated layout, which
    // is what made it "jump").
    pendingPx.current =
      g.type === "col"
        ? Math.round(g.base + (e.clientX - g.startX))
        : Math.round(g.base + (e.clientY - g.startY));
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  /* Release: if we never actually resized it was a quick tap — toggle the
     whole row/column selection. Selection is synced HERE (not in an effect) so
     clicking a regular cell afterwards behaves normally. */
  const handleUp = () => {
    const g = gestureRef.current;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    pendingPx.current = null;
    gestureRef.current = null;
    setPulling(null);
    if (!g || g.engaged) return;
    const next =
      bandRef.current &&
      bandRef.current.axis === g.type &&
      bandRef.current.index === g.index
        ? null
        : { axis: g.type, index: g.index };
    bandRef.current = next;
    setBand(next);
    onSelectionChange(
      next
        ? next.axis === "col"
          ? rectOf(0, next.index, grid.rows.length - 1, next.index)
          : rectOf(next.index, 0, next.index, grid.cols - 1)
        : null,
    );
  };

  const cancelResize = () => stopGesture(true);

  return (
    <table
      ref={tableRef}
      className="tgrid"
      style={{ ["--taccent" as string]: accent }}
      aria-label="Team table grid"
    >
      <tbody>
        {rows.map((row, r) => {
          const cells: React.ReactNode[] = [];
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            if (!cell) continue; // covered by a merge

            const key = `${r}:${c}`;
            const row0 = r === 0;
            const col0 = c === 0;
            const merged = cell.rs > 1 || cell.cs > 1;
            const selected = selection != null && inRect(selection, r, c);
            const inBand =
              band != null &&
              (band.axis === "col"
                ? c <= band.index && band.index < c + cell.cs
                : r <= band.index && band.index < r + cell.rs);
            const overlapsToday =
              axis === "cols"
                ? todayIdx >= 0 && c <= todayIdx && todayIdx < c + cell.cs
                : axis === "rows"
                  ? todayIdx >= 0 && r <= todayIdx && todayIdx < r + cell.rs
                  : false;
            const isTodayHeader =
              overlapsToday && (row0 ? axis === "cols" : axis === "rows" && col0);

            const className = [
              merged ? "merged" : "",
              selected ? "selected" : "",
              inBand ? (band.axis === "col" ? "band-col" : "band-row") : "",
              overlapsToday ? "today" : "",
              col0 ? "fc" : "",
            ]
              .filter(Boolean)
              .join(" ");

            /* Column width from grid.sizes (plain cells); sticky fc owns 120px
               via CSS but inline width/min-width win when resized. */
            const w = cell.cs === 1 ? (colSize[c] ?? undefined) : undefined;
            const h = cell.rs === 1 ? (rowSize[r] ?? undefined) : undefined;
            const cellStyle: React.CSSProperties = {};
            if (w != null) {
              // width + min/max-width pin the column to exactly `w` in auto
              // layout so the resize tracks the cursor instead of being
              // redistributed by the browser (the cause of "jumps").
              cellStyle.width = w;
              cellStyle.minWidth = w;
              cellStyle.maxWidth = w;
            }
            if (h != null) {
              cellStyle.height = h;
              cellStyle.minHeight = h;
            }

            const content = editing && editing.r === r && editing.c === c ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full min-w-[48px] bg-transparent text-inherit outline-none"
                aria-label={`Cell value, row ${r + 1}, column ${c + 1}`}
              />
            ) : (
              <span className="whitespace-pre-wrap break-words">{cell.v}</span>
            );

            const Tag = row0 ? "th" : col0 ? "th" : "td";

            cells.push(
              <Tag
                key={key}
                rowSpan={cell.rs}
                colSpan={cell.cs}
                data-r={r}
                data-c={c}
                scope={row0 ? "col" : col0 ? "row" : undefined}
                className={className}
                style={cellStyle}
                onPointerDown={
                  canWrite
                    ? (e) => {
                        if (e.pointerType === "mouse" && e.button !== 0) return;
                        const isSingleSelected =
                          selection != null &&
                          selection.r1 === r &&
                          selection.c1 === c &&
                          selection.r2 === r &&
                          selection.c2 === c;
                        dragRef.current = isSingleSelected ? null : { r, c };
                        bandRef.current = null;
                        setBand(null);
                        onSelectionChange(
                          isSingleSelected ? null : rectOf(r, c, r, c),
                        );
                        // Capture so pointermove/up keep landing here even off
                        // the grid; the hovered cell is hit-tested below, which
                        // never skips cells (unlike mouseenter).
                        (e.currentTarget as HTMLElement).setPointerCapture(
                          e.pointerId,
                        );
                        e.preventDefault();
                      }
                    : undefined
                }
                onPointerMove={
                  canWrite
                    ? (e) => {
                        if (!dragRef.current || gestureRef.current) return;
                        const hit = document.elementFromPoint(
                          e.clientX,
                          e.clientY,
                        );
                        const cell = (hit as HTMLElement | null)?.closest<
                          HTMLElement
                        >("[data-r]");
                        if (!cell) return;
                        onSelectionChange(
                          rectOf(
                            dragRef.current.r,
                            dragRef.current.c,
                            Number(cell.dataset.r),
                            Number(cell.dataset.c),
                          ),
                        );
                      }
                    : undefined
                }
                onPointerUp={
                  canWrite
                    ? () => {
                        dragRef.current = null;
                      }
                    : undefined
                }
                onLostPointerCapture={
                  canWrite
                    ? () => {
                        dragRef.current = null;
                      }
                    : undefined
                }
                onDoubleClick={
                  canWrite
                    ? (e) => {
                        if (cell !== null) {
                          startEdit(r, c, cell.v);
                          e.preventDefault();
                        }
                      }
                    : undefined
                }
              >
                {isTodayHeader && (
                  <span className="today-pill" aria-hidden="true">
                    Today
                  </span>
                )}
                {content}
                {canWrite && (
                  <>
                    {/* Column boundary to the LEFT of this cell = the right edge
                        of column c−1. Hosted HERE so it straddles the boundary
                        (12px) and paints above the neighbour on the left. */}
                    {c > 0 && (
                      <EdgeStrip
                        kind="col"
                        index={c - 1}
                        label={`Resize or select column ${c}`}
                        className="edge-col"
                        active={
                          pulling?.axis === "col" && pulling?.index === c - 1
                        }
                        onDown={startResize}
                        onMove={handleMove}
                        onUp={handleUp}
                        onCancel={cancelResize}
                        onReset={() =>
                          onApply((state) => resetSize(state, "cols", c - 1))
                        }
                      />
                    )}
                    {/* Right edge of the last column — nothing to the right to
                        host on, so keep it inside the last column's cells. */}
                    {c + cell.cs === nCols && (
                      <EdgeStrip
                        kind="col-last"
                        index={nCols - 1}
                        label={`Resize or select column ${nCols}`}
                        className="edge-col-last"
                        active={
                          pulling?.axis === "col" &&
                          pulling?.index === nCols - 1
                        }
                        onDown={startResize}
                        onMove={handleMove}
                        onUp={handleUp}
                        onCancel={cancelResize}
                        onReset={() =>
                          onApply((state) =>
                            resetSize(state, "cols", nCols - 1),
                          )
                        }
                      />
                    )}
                    {/* Row boundary ABOVE this cell = the bottom edge of row
                        r−1. Hosted here so it straddles the boundary (12px). */}
                    {r > 0 && (
                      <EdgeStrip
                        kind="row"
                        index={r - 1}
                        label={`Resize or select row ${r}`}
                        className="edge-row"
                        active={
                          pulling?.axis === "row" && pulling?.index === r - 1
                        }
                        onDown={startResize}
                        onMove={handleMove}
                        onUp={handleUp}
                        onCancel={cancelResize}
                        onReset={() =>
                          onApply((state) => resetSize(state, "rows", r - 1))
                        }
                      />
                    )}
                    {/* Bottom edge of the last row — nothing below to host on. */}
                    {r + cell.rs === nRows && (
                      <EdgeStrip
                        kind="row-last"
                        index={nRows - 1}
                        label={`Resize or select row ${nRows}`}
                        className="edge-row-last"
                        active={
                          pulling?.axis === "row" &&
                          pulling?.index === nRows - 1
                        }
                        onDown={startResize}
                        onMove={handleMove}
                        onUp={handleUp}
                        onCancel={cancelResize}
                        onReset={() =>
                          onApply((state) =>
                            resetSize(state, "rows", nRows - 1),
                          )
                        }
                      />
                    )}
                  </>
                )}
              </Tag>,
            );
          }
          return <tr key={r}>{cells}</tr>;
        })}
      </tbody>
      <caption className="sr-only">
        {nRows} rows by {nCols} columns.{" "}
        {canWrite
          ? "Drag to select cells, double-click to edit, tap a column or row edge to select it, hold and drag an edge to resize it, double-click an edge to reset its size, press Escape to cancel a resize or clear the selection, click the selected cell again to deselect."
          : "Read-only table."}
      </caption>
    </table>
  );
}

/* A draggable, clickable handle for a single column/row boundary. Pointer
   capture is set in startResize so pointerup always reaches us — that's what
   guarantees a resize stops on release. */
function EdgeStrip(props: {
  kind: EdgeKind;
  index: number;
  label: string;
  className: string;
  active: boolean;
  onDown: (
    e: React.PointerEvent<HTMLElement>,
    kind: EdgeKind,
    index: number,
  ) => void;
  onMove: (e: React.PointerEvent<HTMLElement>) => void;
  onUp: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const { kind, index, label, className, active, onDown, onMove, onUp, onCancel, onReset } =
    props;
  return (
    <span
      role="separator"
      aria-orientation={kind.startsWith("col") ? "vertical" : "horizontal"}
      aria-label={label}
      className={`edge-strip ${className}${active ? " pulling" : ""}`}
      onPointerDown={(e) => onDown(e, kind, index)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
    />
  );
}