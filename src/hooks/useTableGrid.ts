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
import { persistTable } from "@/lib/table/persistTable";
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

/** Starting width for a freshly dropped sticker, scaled to the viewport so it
 *  reads well on a phone and on a desktop without the user resizing first. */
function stickerBaseWidth(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  return Math.max(56, Math.min(96, Math.round(vw * 0.12)));
}

export function useTableGrid(tableId: string | null) {
  const [doc, setDoc] = useState<TableDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const docRef = useRef<TableDocument | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const persistCallbackRef = useRef<(() => Promise<void>) | null>(null);
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
    /* Re-arm the shared cancellation flag for this table. The unmount/flush
       cleanup below sets it, and because the editor does NOT remount when
       `tableId` changes, leaving it set would permanently disable the conflict
       rebase and the CAS-token adoption for every table opened afterwards. */
    cancelledRef.current = false;
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
  /* The save path itself lives in `lib/table/persistTable` so the CAS contract
     can be tested without a DOM; this only supplies the state and applies the
     outcome. It re-reads `docRef.current` before every attempt, so an edit made
     while a request was in flight is never dropped. */
  const persist = useCallback(async () => {
    if (!docRef.current) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setSaveError(null);
    setIsSaving(true);
    try {
      const outcome = await persistTable({
        getDoc: () => {
          const d = docRef.current;
          if (!d) return null;
          /* The wire format calls the grid `cells`; the client document calls it
             `grid`. That rename is why the 409 rebase once read a field the API
             never sends. It is mapped explicitly here, in one place. */
          return {
            id: d.id,
            name: d.name,
            color: d.color,
            isDateBased: d.isDateBased,
            cells: d.grid,
            stickers: d.stickers,
            updatedAt: d.updatedAt,
          };
        },
        adoptToken: (updatedAt) => {
          const current = docRef.current;
          if (!current) return;
          /* Only the token moves: `docRef.current` may already be ahead of what
             the server acknowledged, and that newer local state must stand. */
          const next: TableDocument = { ...current, updatedAt };
          docRef.current = next;
          setDoc(next);
        },
        isCancelled: () => cancelledRef.current,
      });
      if (outcome.status === "cancelled") return;
      if (outcome.status === "saved" || outcome.status === "rebased") {
        setLastSavedAt(Date.now());
        setSaveError(null);
        return;
      }
      setSaveError(outcome.message);
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
      if (saveQueuedRef.current && !cancelledRef.current) {
        saveQueuedRef.current = false;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null;
          void persistCallbackRef.current?.();
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }, []);

  useEffect(() => {
    persistCallbackRef.current = persist;
  }, [persist]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  /* Flush any pending debounce on unmount (or when switching tables) so a quick
     navigation doesn't drop the last cell edit. Both values are read INSIDE the
     cleanup: reading them in the effect body captured them at mount, when the
     load fetch had not resolved yet and both were still null — so the flush
     could never run and the armed timer leaked into the next table. */
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      const timer = saveTimer.current;
      const doc = docRef.current;
      saveTimer.current = null;
      if (timer) clearTimeout(timer);
      if (timer && doc) {
        void persist();
      }
    };
  }, [persist, tableId]);

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
            w: stickerBaseWidth(),
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