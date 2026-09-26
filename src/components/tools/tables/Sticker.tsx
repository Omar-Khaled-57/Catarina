"use client";

/**
 * Sticker — one floating Rina/deco sprite on the table canvas.
 *
 * Behaviours (locked spec):
 *  - Three-state click cycle: play (dance wobble) → pause → frame2 (rotated
 *    ~30°) → play. Clicking advances the state; a locked sticker still cycles.
 *  - Drag moves the sticker anywhere in the canvas (pointer events,
 *    touch-action: none). Lock disables dragging only.
 *  - Hover overlay (top-right): resize (− / +), delete, mirror (toggle),
 *    lock (toggle). Scrolling the mouse wheel over a sticker resizes it too
 *    (page scroll is suppressed while the pointer sits on a sticker).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Trash2, Lock, Unlock, FlipHorizontal, Minus, Plus } from "lucide-react";
import type { StickerData } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { spriteName, spriteUrl } from "./spriteConfig";

interface Props {
  sticker: StickerData;
  canWrite: boolean;
  parentRef: RefObject<HTMLElement | null>;
  onUpdate: (patch: Partial<StickerData>) => void;
  onRemove: () => void;
}

const STATE_ORDER: NonNullable<StickerData["state"]>[] = ["play", "pause", "frame2"];
const DEFAULT_W = 88;
const MIN_W = 40;
const MAX_W = 240;
const STEP_W = 12;

/** Clamp a sticker width, then round to a sane grid so repeated wheel ticks
 *  don't produce ragged fractional sizes. */
function clampW(w: number): number {
  return Math.max(MIN_W, Math.min(MAX_W, Math.round(w)));
}

export default function Sticker({
  sticker,
  canWrite,
  parentRef,
  onUpdate,
  onRemove,
}: Props) {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Variable "you" PFP sprite: mirrors the logged-in user's avatar live.
   * Falls back to a known-good static sprite when the user has no PFP set. */
  const isYou = sticker.sprite === "you";
  const imgSrc =
    isYou && user?.pfp
      ? user.pfp
      : (spriteUrl(sticker.sprite) ?? spriteUrl("happy") ?? undefined);

  const drag = useRef<{
    moved: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wide = sticker.w ?? DEFAULT_W;

  /* Wheel-to-resize. Uses a native listener (non-passive) so we can
   * preventDefault and keep the page from scrolling under the sticker. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !canWrite) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const factor = e.deltaMode === 1 ? 16 : 1; // line mode → pixels
      // Damp the raw delta and snap to the 12px grid; only the FINAL width is
      // clamped. (Running the raw step through clampW — whose 40px floor made
      // every single notch jump the sticker by 40px+.)
      const raw = Math.abs(delta) * factor * 0.15 || 4;
      const step = Math.sign(delta) * Math.max(STEP_W, Math.round(raw / STEP_W) * STEP_W);
      onUpdate({ w: clampW(wide + step) });
      setResizing(true);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => setResizing(false), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    };
  }, [canWrite, wide, onUpdate]);

  const cycle = useCallback(() => {
    const cur = STATE_ORDER.indexOf(sticker.state ?? "play");
    onUpdate({ state: STATE_ORDER[(cur + 1) % STATE_ORDER.length] });
  }, [sticker.state, onUpdate]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canWrite) return;
      drag.current = {
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseX: sticker.x,
        baseY: sticker.y,
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [canWrite, sticker.x, sticker.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
      if (!d.moved) return;
      setDragging(true);
      if (sticker.locked) return; // locked: cycle allowed, movement not
      const parent = parentRef.current;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = Math.min(100, Math.max(0, d.baseX + (dx / rect.width) * 100));
      const y = Math.min(100, Math.max(0, d.baseY + (dy / rect.height) * 100));
      onUpdate({ x, y });
    },
    [sticker.locked, parentRef, onUpdate],
  );

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved) cycle();
  }, [cycle]);

  const state = sticker.state ?? "play";
  const nudge = (dir: number) => () => onUpdate({ w: clampW(wide + dir * STEP_W) });

  return (
    <div
      ref={rootRef}
      className={`table-sticker absolute z-10 select-none state-${state} ${
        canWrite ? "pointer-events-auto" : "pointer-events-none"
      } ${dragging ? "dragging" : ""} ${resizing ? "resizing" : ""} ${
        sticker.locked ? "locked" : ""
      }`}
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: wide,
        transform: "translate(-50%, -50%)",
      }}
      role={canWrite ? "button" : undefined}
      aria-label={
        canWrite
          ? `${spriteName(sticker.sprite)} sticker — click to cycle animation, scroll or use −/+ to resize`
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
    >
      <div
        className="table-sticker-img"
        style={{ transform: sticker.mirrored ? "scaleX(-1)" : undefined }}
      >
        <Image
          src={imgSrc ?? "/rina/happy.webp"}
          alt=""
          width={wide}
          height={wide}
          unoptimized
          draggable={false}
          className="block h-auto w-full"
          style={{ aspectRatio: "1 / 1", objectFit: isYou ? "cover" : "contain" }}
        />
      </div>

      {canWrite && (
        <div
          className="table-sticker-controls absolute -top-2 -right-2 flex gap-1 rounded-xl border border-border/60 bg-surface p-1 shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Make sticker smaller (−)"
            aria-label="Make sticker smaller"
            onClick={nudge(-1)}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            title="Make sticker bigger (+)"
            aria-label="Make sticker bigger"
            onClick={nudge(1)}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            title={`Mirror ${sticker.mirrored ? "on" : "off"} (toggle)`}
            aria-pressed={!!sticker.mirrored}
            aria-label={`Mirror sticker${sticker.mirrored ? " (on)" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ mirrored: !sticker.mirrored });
            }}
            className={`rounded-lg p-1 transition-colors ${
              sticker.mirrored
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <FlipHorizontal size={14} />
          </button>
          <button
            type="button"
            title={sticker.locked ? "Unlock (toggle)" : "Lock — drag disabled (toggle)"}
            aria-pressed={!!sticker.locked}
            aria-label={sticker.locked ? "Unlock sticker" : "Lock sticker"}
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ locked: !sticker.locked });
            }}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            {sticker.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            type="button"
            title="Delete sticker"
            aria-label="Delete sticker"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}