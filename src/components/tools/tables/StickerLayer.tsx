"use client";

/**
 * StickerLayer — absolutely-positioned sticker canvas over the table grid.
 * pointer-events are off for the container so cells stay interactive; each
 * sticker re-enables them only for writers (readers see inert decorations).
 */

import { type RefObject } from "react";
import type { StickerData } from "@/types";
import Sticker from "./Sticker";

interface Props {
  stickers: StickerData[];
  canWrite: boolean;
  parentRef: RefObject<HTMLElement | null>;
  onUpdate: (id: string, patch: Partial<StickerData>) => void;
  onRemove: (id: string) => void;
}

export default function StickerLayer({
  stickers,
  canWrite,
  parentRef,
  onUpdate,
  onRemove,
}: Props) {
  if (stickers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {stickers.map((sticker) => (
        <Sticker
          key={sticker.id}
          sticker={sticker}
          canWrite={canWrite}
          parentRef={parentRef}
          onUpdate={(patch) => onUpdate(sticker.id, patch)}
          onRemove={() => onRemove(sticker.id)}
        />
      ))}
    </div>
  );
}