"use client";

/**
 * Backward-compatible re-export: drawers components previously imported these
 * hooks from this path. The implementation now lives in src/lib/themeSafeColor.ts.
 */

export {
  useThemeSafeColor,
  useThemeSafeGlyphColor,
} from "@/lib/themeSafeColor";