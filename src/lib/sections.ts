// Dynamic Section Loader — fetches sections from DB with fallback to defaults
// Used throughout the app to replace hardcoded SECTIONS/SECTION_COLORS/SECTION_LABELS

import { prisma } from "@/lib/prisma";

/** Section data structure from DB */
export interface SectionData {
  id: string;
  key: string;
  label: string;
  prefix: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

/** Default sections seeded in DB — used as fallback */
const DEFAULT_SECTIONS: Omit<SectionData, "id" | "isActive">[] = [
  { key: "MARKETING", label: "Marketing", prefix: "MRK-", color: "#FF4D6A", sortOrder: 0 },
  { key: "ART", label: "Art", prefix: "ART-", color: "#7C3AED", sortOrder: 1 },
  { key: "TECHNICAL", label: "Technical", prefix: "TEC-", color: "#3B82F6", sortOrder: 2 },
  { key: "MANAGEMENT", label: "Management", prefix: "MNG-", color: "#F59E0B", sortOrder: 3 },
];

/** Cache key and TTL for section data */
let cachedSections: SectionData[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Get all active sections from DB (with 30s in-memory cache).
 * Falls back to default sections if DB is empty.
 */
export async function getSections(): Promise<SectionData[]> {
  const now = Date.now();
  if (cachedSections && now - cacheTimestamp < CACHE_TTL) {
    return cachedSections;
  }

  try {
    const dbSections = await prisma.sectionConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }) as SectionData[];

    if (dbSections.length > 0) {
      cachedSections = dbSections;
      cacheTimestamp = now;
      return dbSections;
    }
  } catch {
    // DB might not have the table yet — fall back to defaults
  }

  // Fallback to default sections
  cachedSections = DEFAULT_SECTIONS.map((s, i) => ({
    ...s,
    id: `default-${s.key.toLowerCase()}`,
    isActive: true,
  }));
  cacheTimestamp = now;
  return cachedSections;
}

/**
 * Get section keys array (e.g. ["MARKETING", "ART", ...])
 */
export async function getSectionKeys(): Promise<string[]> {
  const sections = await getSections();
  return sections.map((s) => s.key);
}

/**
 * Get section labels map (e.g. { MARKETING: "Marketing", ... })
 */
export async function getSectionLabels(): Promise<Record<string, string>> {
  const sections = await getSections();
  return Object.fromEntries(sections.map((s) => [s.key, s.label]));
}

/**
 * Get section colors map (e.g. { MARKETING: "#FF4D6A", ... })
 */
export async function getSectionColors(): Promise<Record<string, string>> {
  const sections = await getSections();
  return Object.fromEntries(sections.map((s) => [s.key, s.color]));
}

/**
 * Get section prefixes map (e.g. { MARKETING: "MRK-", ... })
 */
export async function getSectionPrefixes(): Promise<Record<string, string>> {
  const sections = await getSections();
  return Object.fromEntries(sections.map((s) => [s.key, s.prefix]));
}

/**
 * Invalidate the section cache (call after mutations).
 */
export function invalidateSectionCache(): void {
  cachedSections = null;
  cacheTimestamp = 0;
}

/**
 * Check if a section key is valid.
 */
export async function isValidSection(key: string): Promise<boolean> {
  const sections = await getSections();
  return sections.some((s) => s.key === key.toUpperCase());
}

/**
 * Get a single section by key.
 */
export async function getSectionByKey(key: string): Promise<SectionData | undefined> {
  const sections = await getSections();
  return sections.find((s) => s.key === key.toUpperCase());
}
