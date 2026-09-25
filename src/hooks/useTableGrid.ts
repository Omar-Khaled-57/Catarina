"use client";

/**
 * useTableGrid — document store + debounced autosave for a single TeamTable.
 *
 * Holds the full table document (metadata + grid + stickers) in one state
 * object mirrored by a ref (docRef) so any mutation can synchronously compute
 * the next version, update both, and schedule a single debounced PATCH.
 * Every grid transform is a pure op from src/lib/table/grid.ts applied
 * through applyGrid(); stickers go through explicit add/update/remove helpers.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GridState } from "@/lib/table/grid";
import type { StickerData } from "@/types";
import { spriteUrl } from "@/components/tools/tables/spriteConfig";

export interface TableDocument {
  id: string;
  section: string;
  name: string;
  color: string;
  isDateBased: boolean;
  grid: GridState;
  stickers: StickerData[];
  /** ISO updatedAt of the revision this document was loaded from — the CAS
      token echoed back on every save so the server rejects stale writes. */
  updatedAt: string | null;
}

const SAVE_DEBOUNCE_MS = 600;

export function useTableGrid(tableId: string | null) {
  const [doc, setDoc] = useState<TableDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const docRef = useRef<TableDocument | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Guards the 409-rebase fetch in persist(): if the hook has already unmounted
     (e.g. the user navigated away mid-save) we must not call setDoc/setSaveError
     on a dead component. Set true in the unmount cleanup below. */
  const cancelledRef = useRef(false);

  /* ── Load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!tableId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no table to load
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/tables/${tableId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Table not found");
        return await res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const table = data.table;
        const next: TableDocument = {
          id: table.id,
          section: table.section,
          name: table.name,
          color: table.color,
          isDateBased: table.isDateBased,
          grid: table.cells,
          stickers: Array.isArray(table.stickers) ? table.stickers : [],
          /* CAS token: the revision we loaded. The server requires it on every
             PATCH — a doc without it is stale-by-definition and would clobber a
             peer, so a missing value here must echo null and fail closed. */
          updatedAt: table.updatedAt ?? null,
        };
        docRef.current = next;
        setDoc(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load this table");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  /* ── Persist ──────────────────────────────────────────────────────────── */
  const persist = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/tables/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          color: d.color,
          isDateBased: d.isDateBased,
          cells: d.grid,
          stickers: d.stickers,
          /* CAS token: the updatedAt of the revision we loaded. Without it the
             server (which now enforces optimistic concurrency fail-closed)
             rejects the write; with it we only bump when nobody else wrote in
             the meantime, so a second editor's live changes are never silently
             clobbered. */
          expectedUpdatedAt: d.updatedAt,
        }),
      });
      if (res.status === 409) {
        /* Someone else saved a newer revision since we loaded. Fetch the
           freshest row so the next save rebases on it instead of overwriting
           that editor's work. Surface it as a visible conflict, not a silent
           last-write-wins. */
        const latestRes = await fetch(`/api/tables/${d.id}`);
        const latestData = latestRes.ok ? await latestRes.json() : null;
        if (!cancelledRef.current && latestData?.table) {
          const latest = latestData.table;
          const next: TableDocument = {
            id: latest.id,
            section: latest.section,
            name: latest.name,
            color: latest.color,
            isDateBased: latest.isDateBased,
            grid: latest.grid,
            stickers: Array.isArray(latest.stickers) ? latest.stickers : [],
            updatedAt: latest.updatedAt,
          };
          docRef.current = next;
          setDoc(next);
          setSaveError("Someone else changed this table — we loaded their latest copy. Your edits weren't lost; please re-apply on top.");
          return;
        }
        throw new Error("save failed");
      }
      if (!res.ok) throw new Error("save failed");
      setLastSavedAt(Date.now());
    } catch {
      setSaveError("Your last change didn't save — reconnecting in the background");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }, [persist]);

  /* Flush any pending debounce on unmount so a quick navigation doesn't drop
     the last cell edit. persist() reads docRef.current, which holds the freshest
     document, so the final write carries everything up to the unmount. */
  useEffect(() => {
    const doc = docRef.current;
    const timer = saveTimer.current;
    return () => {
      cancelledRef.current = true;
      saveTimer.current = null;
      if (timer && doc) {
        clearTimeout(timer);
        void persist();
      }
    };
  }, [persist]);

  /* ── Mutate (single path: ref + state stay in lockstep, then debounce) ── */
  const mutate = useCallback(
    (produce: (d: TableDocument) => TableDocument) => {
      const prev = docRef.current;
      if (!prev) return;
      const next = produce(prev);
      docRef.current = next;
      setDoc(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  /** Apply a pure grid transform from the grid engine. */
  const applyGrid = useCallback(
    (op: (g: GridState) => GridState) => {
      mutate((d) => ({ ...d, grid: op(d.grid) }));
    },
    [mutate],
  );

  const setColor = useCallback(
    (color: string) => mutate((d) => ({ ...d, color })),
    [mutate],
  );

  const toggleDateMode = useCallback(
    () => mutate((d) => ({ ...d, isDateBased: !d.isDateBased })),
    [mutate],
  );

  const rename = useCallback(
    (name: string) => mutate((d) => ({ ...d, name })),
    [mutate],
  );

  const addSticker = useCallback(
    (sprite: string) =>
      mutate((d) => ({
        ...d,
        stickers: [
          ...d.stickers,
          {
            id:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `s-${Math.random().toString(36).slice(2, 9)}`,
            sprite,
            x: 35 + Math.random() * 30,
            y: 30 + Math.random() * 40,
            locked: false,
            mirrored: false,
            state: "play",
          },
        ],
      })),
    [mutate],
  );

  const updateSticker = useCallback(
    (id: string, patch: Partial<StickerData>) =>
      mutate((d) => ({
        ...d,
        stickers: d.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),
    [mutate],
  );

  const removeSticker = useCallback(
    (id: string) =>
      mutate((d) => ({ ...d, stickers: d.stickers.filter((s) => s.id !== id) })),
    [mutate],
  );

  return {
    doc,
    loading,
    loadError,
    isSaving,
    saveError,
    lastSavedAt,
    spriteUrl,
    applyGrid,
    setColor,
    toggleDateMode,
    rename,
    addSticker,
    updateSticker,
    removeSticker,
  };
}

export type UseTableGrid = ReturnType<typeof useTableGrid>;