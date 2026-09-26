// Dynamic Section Loader — fetches sections from DB with fallback to defaults
// Used throughout the app to replace hardcoded SECTIONS/SECTION_COLORS/SECTION_LABELS

import { prisma } from "@/lib/prisma";
import { FALLBACK_SECTIONS } from "@/types";

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

/** Cache key and TTL for section data */
let cachedSections: SectionData[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds
const FAILURE_BACKOFF_MS = 10_000;
const FAILURE_LOG_INTERVAL_MS = 30_000;
let retryAfter = 0;
let nextFailureLogAt = 0;
let cacheGeneration = 0;
let sectionsRequest: Promise<SectionData[]> | null = null;

/**
 * Get all active sections from DB (with 30s in-memory cache).
 * Falls back to default sections if DB is empty.
 */
export async function getSections(): Promise<SectionData[]> {
  const now = Date.now();
  if (cachedSections && now - cacheTimestamp < CACHE_TTL) {
    return cachedSections;
  }
  if (sectionsRequest) return sectionsRequest;
  if (now < retryAfter) return cachedSections ?? fallbackSections();

  const generation = cacheGeneration;
  const request = loadSections(generation);
  sectionsRequest = request;
  try {
    return await request;
  } finally {
    if (sectionsRequest === request) sectionsRequest = null;
  }
}

async function loadSections(generation: number): Promise<SectionData[]> {
  try {
    const dbSections = await prisma.sectionConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }) as SectionData[];

    if (dbSections.length > 0) {
      if (generation === cacheGeneration) {
        cachedSections = dbSections;
        cacheTimestamp = Date.now();
        retryAfter = 0;
      }
      return dbSections;
    }

    // Genuine empty table (fresh deploy before seeding) — safe to cache.
    const fallback = fallbackSections();
    if (generation === cacheGeneration) {
      cachedSections = fallback;
      cacheTimestamp = Date.now();
      retryAfter = 0;
    }
    return fallback;
  } catch (error) {
    const failedAt = Date.now();
    if (generation === cacheGeneration) retryAfter = failedAt + FAILURE_BACKOFF_MS;
    if (failedAt >= nextFailureLogAt) {
      nextFailureLogAt = failedAt + FAILURE_LOG_INTERVAL_MS;
      const source = cachedSections ? "last-known sections" : "default sections";
      console.warn(
        `[SECTIONS] SectionConfig read failed, serving ${source} during retry backoff:`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return cachedSections ?? fallbackSections();
  }
}

function fallbackSections(): SectionData[] {
  return FALLBACK_SECTIONS.map((s) => ({
    ...s,
    id: `default-${s.key.toLowerCase()}`,
  }));
}

/**
 * Get section keys array (e.g. ["MARKETING", "ART", ...])
 */
export async function getSectionKeys(): Promise<string[]> {
  const sections = await getSections();
  return sections.map((s) => s.key);
}

/**
 * Whether a caller-supplied section string names a real, active section.
 *
 * Section keys are stored uppercase, but anything an admin can type reaches the
 * write paths, so an unvalidated value like "Foo" or "MARKETING " would persist
 * a goal/table into a section no membership row can ever match — invisible to
 * members and uneditable, while still visible to admins. Every create path
 * funnels through here so the rule is stated once.
 */
export async function isKnownSection(value: string): Promise<boolean> {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return false;
  return (await getSectionKeys()).includes(normalized);
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
  cacheGeneration++;
  cachedSections = null;
  cacheTimestamp = 0;
  retryAfter = 0;
  sectionsRequest = null;
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
