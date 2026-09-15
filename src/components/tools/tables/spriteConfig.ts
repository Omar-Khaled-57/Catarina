/**
 * Sticker sprite registry for TeamTable.
 *
 * Rina poses live in /public/rina/*.webp (already shipped). The decorative
 * sprites (heart, sparkle, star) are slated assets: their picker entries SHOW
 * only once the matching webp exists in public/rina — the picker probes each
 * url at runtime and hides missing ones (see useAvailableSprites).
 */

export interface SpriteDef {
  id: string;
  name: string;
  kind: "rina" | "deco";
}

/** Order in which the picker lists stickers. */
export const SPRITE_DEFS: SpriteDef[] = [
  { id: "happy", name: "Happy", kind: "rina" },
  { id: "wave", name: "Wave", kind: "rina" },
  { id: "think", name: "Think", kind: "rina" },
  { id: "excited", name: "Excited", kind: "rina" },
  { id: "thumb", name: "Thumb up", kind: "rina" },
  { id: "heart", name: "Heart", kind: "deco" },
  { id: "sparkle", name: "Sparkle", kind: "deco" },
  { id: "star", name: "Star", kind: "deco" },
];

export const RINA_POSES = SPRITE_DEFS.filter((s) => s.kind === "rina");

/** Public URL for a sticker sprite. */
export function spriteUrl(sprite: string): string {
  return `/rina/${sprite}.webp`;
}

export function spriteName(id: string): string {
  return SPRITE_DEFS.find((s) => s.id === id)?.name ?? id;
}