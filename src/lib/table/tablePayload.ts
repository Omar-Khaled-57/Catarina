/**
 * Server-side validation for the `cells` / `stickers` blobs a table save
 * carries.
 *
 * WHY THIS IS A MODULE: the previous check lived inline in the route and only
 * bounded the OUTER dimensions (`rows.length`, `cols`). A request could still
 * put an unbounded amount of text inside a single row — one ordinary member
 * could write megabytes per request straight into a shared database row. The
 * bounds below are pure, so they are unit-tested here rather than only being
 * reachable through an HTTP request.
 *
 * All limits sit far above what the editor can actually produce (a full
 * 200x200 grid of maximum-length cells serializes to ~160 KB), so they reject
 * hostile traffic without constraining real use.
 */

import { MAX_GRID_SIZE } from "./grid";

/** Per-cell text. Matches the longest cell the UI can type in practice. */
export const MAX_CELL_TEXT = 2_000;

/** Stickers per table. A full table of them is still a small JSON document. */
export const MAX_STICKERS = 500;

export const MAX_STICKER_ID = 64;
export const MAX_STICKER_SPRITE = 64;

/**
 * Whole-document ceiling, as a backstop against deeply-nested junk.
 *
 * Deliberately below Vercel's ~4.5 MB request-body cap (the drawers route uses
 * the same reasoning at 4.38 MB) so the handler returns a clear 400 instead of
 * letting the platform reject the request with an opaque error. Sized so a
 * genuinely large table — a few thousand fully-populated cells — still saves
 * normally.
 */
export const MAX_SERIALIZED_BYTES = 4_000_000;

/** Thrown-free by design: `validateCells`/`validateStickers` return an error
 *  message string, or `null` when the value is acceptable, so the route can map
 *  it straight onto its 400 response. */
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type StickerState = "play" | "pause" | "frame2";

/** A sticker that passed validation, carrying only recognized fields. */
export interface ValidatedSticker {
  id: string;
  sprite: string;
  x: number;
  y: number;
  w?: number;
  locked?: boolean;
  mirrored?: boolean;
  state?: StickerState;
}

/**
 * A cell is `{v, rs, cs}` or null where a merge covers it. The span check is
 * not cosmetic: a zero or negative `rs`/`cs` would break the merge/overlap
 * engine that renders the grid on the read path.
 */
export function isValidCell(cell: unknown): boolean {
  if (cell === null) return true;
  if (typeof cell !== "object") return false;
  const c = cell as { v?: unknown; rs?: unknown; cs?: unknown };
  if (typeof c.v !== "string" || c.v.length > MAX_CELL_TEXT) return false;
  return (
    Number.isSafeInteger(c.rs) && (c.rs as number) >= 1 && (c.rs as number) <= MAX_GRID_SIZE &&
    Number.isSafeInteger(c.cs) && (c.cs as number) >= 1 && (c.cs as number) <= MAX_GRID_SIZE
  );
}

/** Sticker position is a percentage of the canvas; the drag handler clamps it
 *  to 0–100, so anything outside that is not something the editor can produce. */
export const MIN_STICKER_POS = 0;
export const MAX_STICKER_POS = 100;

/** Sticker width in px. Mirrors MIN_W/MAX_W in components/tables/Sticker.tsx. */
export const MIN_STICKER_W = 40;
export const MAX_STICKER_W = 240;

const STICKER_STATES = ["play", "pause", "frame2"] as const;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Validate a sticker and return it with only the known fields, normalized.
 *
 * Every field is checked, not just `id`/`sprite`. The sticker geometry is
 * interpolated straight into the PDF export's HTML (`left:${x}%`, and `sprite`
 * inside a quoted `src`), and that document is written into a SAME-ORIGIN
 * iframe via `document.write` — so an unvalidated `sprite` or `x` is a stored
 * XSS that runs with the victim's session. Rebuilding the object from the
 * fields we recognize also drops any unknown keys an attacker appended, so
 * nothing unvetted is persisted or rendered.
 */
export function validateSticker(sticker: unknown): ValidatedSticker | null {
  if (typeof sticker !== "object" || sticker === null || Array.isArray(sticker)) return null;
  const s = sticker as Record<string, unknown>;

  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > MAX_STICKER_ID) return null;
  if (typeof s.sprite !== "string" || s.sprite.length === 0 || s.sprite.length > MAX_STICKER_SPRITE) {
    return null;
  }
  /* The sprite becomes `/rina/<sprite>.webp`. Restrict it to a plain file stem so
     it cannot escape that directory or carry quotes, slashes or whitespace. */
  if (!/^[A-Za-z0-9_-]+$/.test(s.sprite)) return null;

  if (!isFiniteNumber(s.x) || s.x < MIN_STICKER_POS || s.x > MAX_STICKER_POS) return null;
  if (!isFiniteNumber(s.y) || s.y < MIN_STICKER_POS || s.y > MAX_STICKER_POS) return null;

  if (s.w !== undefined) {
    if (!isFiniteNumber(s.w) || s.w < MIN_STICKER_W || s.w > MAX_STICKER_W) return null;
  }
  if (s.locked !== undefined && typeof s.locked !== "boolean") return null;
  if (s.mirrored !== undefined && typeof s.mirrored !== "boolean") return null;
  if (s.state !== undefined && !STICKER_STATES.includes(s.state as StickerState)) return null;

  const out: ValidatedSticker = { id: s.id, sprite: s.sprite, x: s.x, y: s.y };
  if (s.w !== undefined) out.w = s.w;
  if (s.locked !== undefined) out.locked = s.locked;
  if (s.mirrored !== undefined) out.mirrored = s.mirrored;
  if (s.state !== undefined) out.state = s.state as StickerState;
  return out;
}

export interface ValidatedCells {
  /** Ready to persist. */
  serialized: string;
}

/**
 * Validate a `cells` payload and return its serialized form.
 * Checks the outer dimensions, every row's width, every cell, and the total
 * serialized size.
 */
export function validateCells(raw: unknown): ValidationResult<ValidatedCells> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Invalid cells" };
  }
  const cells = raw as { rows?: unknown; cols?: unknown };

  /* `cols` used to be accepted on `typeof === "number"`, which let NaN, 0,
     negatives and fractions through: `NaN > MAX` is false, so NaN sailed
     through, and a negative `cols` makes every downstream width calculation
     nonsense. It must be a positive safe integer. */
  if (!Number.isSafeInteger(cells.cols) || (cells.cols as number) < 1) {
    return { ok: false, error: "Invalid column count" };
  }
  const cols = cells.cols as number;

  if (!Array.isArray(cells.rows)) {
    return { ok: false, error: "Invalid cells structure" };
  }
  /* An empty grid is not something the editor produces, and a grid with no
     columns cannot be rendered at all. */
  if (cells.rows.length < 1) {
    return { ok: false, error: "Grid has no rows" };
  }
  if (cells.rows.length > MAX_GRID_SIZE || cols > MAX_GRID_SIZE) {
    return { ok: false, error: `Grid exceeds maximum size of ${MAX_GRID_SIZE}×${MAX_GRID_SIZE}` };
  }
  for (const row of cells.rows) {
    if (!Array.isArray(row)) {
      return { ok: false, error: "Invalid row structure" };
    }
    /* Rows must be exactly `cols` wide. Ragged rows used to pass, so a stored
       table could disagree with itself about how many columns it has — the
       renderer walks `cols` while the data had a different length, and the
       merge engine reads past the end of short rows. */
    if (row.length !== cols) {
      return { ok: false, error: "Row width does not match column count" };
    }
    if (!row.every(isValidCell)) {
      return { ok: false, error: "Invalid cell" };
    }
  }
  const serialized = JSON.stringify(cells);
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    return { ok: false, error: "Table content too large" };
  }
  return { ok: true, value: { serialized } };
}

/** Validate a `stickers` payload and return its serialized form. */
export function validateStickers(raw: unknown): ValidationResult<string> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Invalid stickers" };
  }
  if (raw.length > MAX_STICKERS) {
    return { ok: false, error: `Too many stickers (max ${MAX_STICKERS})` };
  }
  const cleaned: ValidatedSticker[] = [];
  for (const item of raw) {
    const sticker = validateSticker(item);
    if (!sticker) return { ok: false, error: "Invalid sticker" };
    cleaned.push(sticker);
  }
  const serialized = JSON.stringify(cleaned);
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    return { ok: false, error: "Table stickers too large" };
  }
  return { ok: true, value: serialized };
}
