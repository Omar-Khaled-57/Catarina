"use client";

/**
 * StickerPicker — lets a writer add a sticker to the table from the sprite
 * registry. Probes each sprite's asset url at runtime so a decorative sprite
 * that hasn't been shipped yet is simply hidden. The `you` sticker has no
 * static asset — it previews the logged-in user's own PFP and falls back to
 * their initial when they haven't set one.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
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
            if (id === "you") {
              found.add(id); // variable PFP — always available
              resolve();
              return;
            }
            const url = spriteUrl(id);
            if (!url) {
              resolve();
              return;
            }
            const img = new window.Image();
            img.onload = () => {
              found.add(id);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
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

type Tab = "all" | "rina" | "deco";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rina", label: "Rina" },
  { id: "deco", label: "Deco" },
];

export default function StickerPicker({ isOpen, onClose, onAdd }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const ids = useMemo(() => SPRITE_DEFS.map((s) => s.id), []);
  const { available, checked } = useAvailableSprites(ids);
  const sprites = useMemo(
    () =>
      checked && available.size > 0
        ? SPRITE_DEFS.filter((s) => available.has(s.id))
        : [],
    [checked, available],
  );

  const visible = useMemo(() => {
    if (tab === "all") return sprites;
    if (tab === "rina") {
      return sprites.filter((s) => s.kind === "rina" || s.kind === "you");
    }
    return sprites.filter((s) => s.kind === "deco");
  }, [tab, sprites]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a sticker" maxWidth="max-w-lg">
      <p className="mb-4 text-sm text-text-muted">
        Drop a Rina, your own face, or a small decoration onto the table. Click
        it afterwards to cycle play → pause → frame 2.
      </p>

      <div className="mb-4 flex gap-1 rounded-xl border border-border/60 bg-surface-2/40 p-1">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === tb.id
                ? "bg-surface-2 text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {!checked || visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {!checked ? "Loading stickers…" : "No stickers in this category yet."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {visible.map((s) => {
            const isYou = s.id === "you";
            const src = isYou ? user?.pfp : spriteUrl(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onAdd(s.id);
                  onClose();
                }}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-surface-2/40 p-3 transition-all hover:border-accent/40 hover:bg-surface-2"
              >
                <span className="relative flex h-16 w-16 items-center justify-center">
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className={`object-contain transition-transform group-hover:scale-105 ${
                        isYou
                          ? "h-16 w-16 rounded-[18px] object-cover ring-2 ring-accent/50"
                          : "h-16 w-16"
                      }`}
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-surface-2 text-2xl font-extrabold text-accent">
                      {user?.name?.charAt(0).toUpperCase() ?? "Y"}
                    </span>
                  )}
                  {isYou && (
                    <span className="absolute -bottom-1 -end-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-accent-ink shadow">
                      you
                    </span>
                  )}
                </span>
                <span className="text-xs font-semibold text-text">{spriteName(s.id)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
