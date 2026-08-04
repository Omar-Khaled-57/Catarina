/**
 * Shared goal-merge logic for realtime deltas.
 * Pure function so it can be unit-tested without a DOM.
 */

/** Anything with an id can be merged; updatedAt is compared when present */
export type Mergeable = { id: string; updatedAt?: unknown };

/**
 * Upsert `delta` items into `current`:
 * - existing goals are replaced when their updatedAt differs
 * - genuinely new goals are appended (preserving current order otherwise)
 * - if nothing changed, the original array reference is returned (no re-render)
 *
 * `delta` items are only read for id/updatedAt, so a full GoalData delta can
 * be merged into a narrower state type (e.g. DashboardGoal).
 */
export function mergeGoals<T extends Mergeable>(current: T[], delta: Mergeable[]): T[] {
  if (!delta || delta.length === 0) return current;

  const byId = new Map(current.map((g) => [g.id, g]));
  let changed = false;

  for (const d of delta) {
    const existing = byId.get(d.id);
    if (!existing || String(existing.updatedAt) !== String(d.updatedAt)) {
      byId.set(d.id, d as T);
      changed = true;
    }
  }

  return changed ? [...byId.values()] : current;
}

/**
 * Extract a duplicate-key from goals that expose `name`/`section`/`monthId`.
 * Returns null for goals that don't (so non-goal Mergeables are never matched).
 */
function pendingKeyOf(g: unknown): string | null {
  if (typeof g !== "object" || g === null) return null;
  const { name, section, monthId } = g as Record<string, unknown>;
  if (typeof name !== "string" || typeof section !== "string" || typeof monthId !== "string") {
    return null;
  }
  return `${section}::${monthId}::${name}`;
}

function isTempGoal(g: unknown): boolean {
  return (
    typeof g === "object" &&
    g !== null &&
    typeof (g as { id?: unknown }).id === "string" &&
    (g as { id: string }).id.startsWith("temp-")
  );
}

/**
 * Merge realtime deltas while de-duplicating against pending optimistic goals.
 *
 * When a delta goal is the server-confirmed twin of a client-side temp goal
 * (same section/month/name — the temp id can't be matched), the temp goal is
 * replaced in place by the real goal. This avoids a transient duplicate
 * (temp + real) while the POST that created the goal is still resolving, and
 * keeps the real goal even if the optimistic POST later fails and rolls back.
 */
export function mergeGoalsDedupeTemp<T extends Mergeable>(current: T[], delta: Mergeable[]): T[] {
  if (!delta || delta.length === 0) return current;

  const deltaByKey = new Map<string, Mergeable>();
  for (const d of delta) {
    const k = pendingKeyOf(d);
    if (k) deltaByKey.set(k, d);
  }

  const replacedKeys = new Set<string>();
  let changed = false;
  const next: T[] = current.map((g) => {
    if (!isTempGoal(g)) return g;
    const k = pendingKeyOf(g);
    if (k === null) return g;
    const real = deltaByKey.get(k);
    if (!real) return g;
    replacedKeys.add(k);
    changed = true;
    return real as T;
  });

  if (!changed) return mergeGoals(current, delta);

  /* Only merge the deltas that weren't already applied as replacements */
  const remaining = delta.filter((d) => !replacedKeys.has(pendingKeyOf(d) ?? ""));
  return mergeGoals(next, remaining);
}
