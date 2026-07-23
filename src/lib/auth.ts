// Shared Authentication Constants & Types
// Safe to import in both client and server code

/**
 * Section enum values used throughout the application.
 * Matches the CSV sheet structure exactly.
 */
export const SECTIONS = ["MARKETING", "ART", "TECHNICAL", "MANAGEMENT"] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * Human-readable section display names.
 */
export const SECTION_LABELS: Record<Section, string> = {
  MARKETING: "Marketing",
  ART: "Art",
  TECHNICAL: "Technical",
  MANAGEMENT: "Management",
};

/** Section color mappings for charts and UI accents */
export const SECTION_COLORS: Record<Section, string> = {
  MARKETING: "#FF4D6A",
  ART: "#7C3AED",
  TECHNICAL: "#3B82F6",
  MANAGEMENT: "#F59E0B",
};
