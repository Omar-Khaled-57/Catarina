/**
 * Sticker sprite registry for TeamTable.
 *
 * Every sticker in public/rina is registered here:
 *   - 19 Rina poses (mascot expressions / poses), all shipped as .webp
 *   - 1 decorative sprite (sparkle) shipped as crisp SVG
 *   - `you` — a variable mascot: renders the logged-in user's current PFP,
 *     resolved live by Sticker.tsx (it has no static asset).
 *
 * The picker probes each sprite url at runtime and hides missing assets, so
 * dropping a file into public/rina is enough to surface it to users.
 */

export interface SpriteDef {
  id: string;
  name: string;
  kind: "rina" | "deco" | "you";
}

/** Order in which the picker lists stickers. */
export const SPRITE_DEFS: SpriteDef[] = [
  /* Rina — the core poses, favorites first */
  { id: "happy", name: "Happy", kind: "rina" },
  { id: "wave", name: "Wave", kind: "rina" },
  { id: "think", name: "Think", kind: "rina" },
  { id: "excited", name: "Excited", kind: "rina" },
  { id: "thumb", name: "Thumb up", kind: "rina" },
  { id: "celebration", name: "Celebration", kind: "rina" },
  { id: "bug-fix", name: "Bug fix", kind: "rina" },
  { id: "update", name: "Update", kind: "rina" },
  { id: "edit", name: "Edit", kind: "rina" },
  { id: "note", name: "Note", kind: "rina" },
  { id: "pointing", name: "Pointing", kind: "rina" },
  { id: "deadline", name: "Deadline", kind: "rina" },
  { id: "dealine", name: "Dealine", kind: "rina" },
  { id: "role-changed", name: "Role changed", kind: "rina" },
  { id: "cry", name: "Cry", kind: "rina" },
  { id: "bye", name: "Bye", kind: "rina" },
  { id: "sleeping", name: "Sleeping", kind: "rina" },
  { id: "404", name: "Lost 404", kind: "rina" },
  { id: "logo", name: "Logo", kind: "rina" },

  /* Variable PFP sticker — the logged-in user's own avatar */
  { id: "you", name: "You", kind: "you" },

  /* Decorative sprites */
  { id: "sparkle", name: "Sparkle", kind: "deco" },
];

export const RINA_POSES = SPRITE_DEFS.filter((s) => s.kind === "rina");
export const DECO_SPRITES = SPRITE_DEFS.filter((s) => s.kind === "deco");
export const YOU_SPRITES = SPRITE_DEFS.filter((s) => s.kind === "you");

/** Public URL for a sprite. `you` has no static asset, so it is null. */
export function spriteUrl(id: string): string | null {
  if (id === "you") return null;
  const def = SPRITE_DEFS.find((s) => s.id === id);
  const ext = def?.kind === "deco" ? "svg" : "webp";
  return `/rina/${id}.${ext}`;
}

export function spriteName(id: string): string {
  return SPRITE_DEFS.find((s) => s.id === id)?.name ?? id;
}
