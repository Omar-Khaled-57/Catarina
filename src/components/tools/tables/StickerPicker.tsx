"use client";

/**
 * StickerPicker — lets a writer add a sticker to the table from the sprite
 * registry. Probes each sprite's asset url at runtime so decorative sprites
 * that haven't been shipped yet (heart/sparkle/star) are simply hidden.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import { SPRITE_DEFS, spriteName, spriteUrl } from "./spriteConfig";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sprite: string) => void;
}

function useAvailableSprites(
  ids: string[],
): { available: Set<string>; checked: boolean } {
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    const found = new Set<string>();
    Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => {
              found.add(id);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = spriteUrl(id);
          }),
      ),
    ).then(() => {
      if (!cancelled) {
        setAvailable(found);
        setChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids is static
  }, [key]);

  return { available, checked };
}

export default function StickerPicker({ isOpen, onClose, onAdd }: Props) {
  const ids = useMemo(() => SPRITE_DEFS.map((s) => s.id), []);
  const { available, checked } = useAvailableSprites(ids);
  const sprites =
    checked && available.size > 0
      ? SPRITE_DEFS.filter((s) => available.has(s.id))
      : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a sticker" maxWidth="max-w-md">
      <p className="mb-4 text-sm text-text-muted">
        Drop a Rina or a small decoration onto the table. Click it afterwards
        to cycle play → pause → frame 2.
      </p>
      {!checked || sprites.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {!checked ? "Loading stickers…" : "No stickers available yet."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {sprites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onAdd(s.id);
                onClose();
              }}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-surface-2/40 p-3 transition-all hover:border-accent/40 hover:bg-surface-2"
            >
              <Image
                src={spriteUrl(s.id)}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 object-contain transition-transform group-hover:scale-105"
              />
              <span className="text-xs font-semibold text-text">{spriteName(s.id)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}