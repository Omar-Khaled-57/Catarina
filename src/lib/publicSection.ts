/**
 * Public projection for the sections list.
 *
 * WHY: `/api/sections` must stay unauthenticated — the registration form runs
 * on the login page, before there is a session. It used to serialize whole
 * `SectionConfig` rows, which handed anonymous callers the internal primary
 * keys and the `sortOrder`/`isActive` admin metadata they have no use for.
 *
 * This module defines the exact public shape, so the boundary is explicit and
 * testable rather than an inline map that silently widens when the DB schema
 * grows a column. Anything not listed here is admin-only and must be fetched
 * from the authenticated `/api/admin/sections`.
 */

/** The only fields an anonymous caller may see. */
export const PUBLIC_SECTION_FIELDS = ["key", "label", "color", "prefix"] as const;

export type PublicSection = {
  key: string;
  label: string;
  color: string;
  prefix: string;
};

/** The internal row shape this projection deliberately narrows. */
export type SectionRow = {
  id: string;
  key: string;
  label: string;
  prefix: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

/** Strip a section row down to its public, display-only fields. */
export function toPublicSection(row: SectionRow): PublicSection {
  return {
    key: row.key,
    label: row.label,
    color: row.color,
    prefix: row.prefix,
  };
}

export function toPublicSections(rows: SectionRow[]): PublicSection[] {
  return rows.map(toPublicSection);
}
