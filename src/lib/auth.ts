// Shared Authentication Constants & Types
// Safe to import in both client and server code
// Derived from FALLBACK_SECTIONS in @/types (single source of truth)

import { FALLBACK_SECTIONS } from "@/types";

/**
 * Section enum values used throughout the application.
 * Derived from FALLBACK_SECTIONS — do not duplicate.
 */
export const SECTIONS = FALLBACK_SECTIONS.map((s) => s.key) as readonly string[];
export type Section = (typeof SECTIONS)[number];

/**
 * Human-readable section display names.
 */
export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  FALLBACK_SECTIONS.map((s) => [s.key, s.label])
);

/** Section color mappings for charts and UI accents */
export const SECTION_COLORS: Record<string, string> = Object.fromEntries(
  FALLBACK_SECTIONS.map((s) => [s.key, s.color])
);
