/**
 * The table save path, extracted from the `useTableGrid` hook so it can be
 * tested without a DOM.
 *
 * This code carries the optimistic-concurrency contract, so it is deliberately
 * explicit about the two things that are easy to get wrong:
 *
 *  1. The server bumps `updatedAt` on every accepted write, so the client must
 *     adopt the token from each successful response. Replaying the token it
 *     loaded with makes every save after the first conflict with itself.
 *  2. A 409 means a peer wrote first. The recovery rebases ONLY the concurrency
 *     token and retries, so the local unsaved edits survive. It must never
 *     replace the document with the server copy, and it must not loop.
 */

export interface TableSaveDoc {
  id: string;
  name: string;
  color: string;
  isDateBased: boolean;
  cells: unknown;
  stickers: unknown;
  updatedAt: string | null;
}

export type PersistOutcome =
  /** The write was accepted; the new token has been adopted. */
  | { status: "saved" }
  /** A peer wrote first; the token was rebased and the save retried successfully. */
  | { status: "rebased"; message: string }
  /** A peer is writing repeatedly; local edits are intact but unsaved. */
  | { status: "conflict"; message: string }
  /** The server refused the write (validation, throttle); nothing was retried. */
  | { status: "rejected"; message: string }
  /** The request never completed (offline, DNS, 5xx). */
  | { status: "offline"; message: string }
  /** The editor was torn down mid-flight; state must not be touched. */
  | { status: "cancelled" };

export const REBASE_MESSAGE =
  "Someone else changed this table — your edits were re-applied on top of theirs.";
export const CONFLICT_MESSAGE =
  "Someone else keeps changing this table — your edits are still here, try saving again in a moment.";
export const OFFLINE_MESSAGE =
  "Your last change didn't save — check your connection and try again";

export interface PersistOptions {
  /** Reads the freshest document. Called again before every attempt. */
  getDoc: () => TableSaveDoc | null;
  /** Called with the server's new `updatedAt` so the caller can store it. */
  adoptToken: (updatedAt: string) => void;
  /** True once the editor unmounted; aborts without touching state. */
  isCancelled: () => boolean;
  fetchImpl?: typeof fetch;
  /** Total attempts, including the first. Defaults to 2 (one retry). */
  maxAttempts?: number;
}

/** Build the PATCH body. `expectedUpdatedAt` is the CAS token. */
function saveBody(doc: TableSaveDoc): string {
  return JSON.stringify({
    name: doc.name,
    color: doc.color,
    isDateBased: doc.isDateBased,
    cells: doc.cells,
    stickers: doc.stickers,
    expectedUpdatedAt: doc.updatedAt,
  });
}

/** Pull the server's reason out of an error response, if it sent one. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = typeof body?.error === "string" ? body.error : fallback;
  if (res.status === 429) return `${detail} — wait a moment and make another edit to retry.`;
  return detail;
}

export async function persistTable(opts: PersistOptions): Promise<PersistOutcome> {
  const { getDoc, adoptToken, isCancelled, maxAttempts = 2 } = opts;
  const doFetch = opts.fetchImpl ?? fetch;

  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt++) {
    const doc = getDoc();
    if (!doc) return { status: "cancelled" };

    let res: Response;
    try {
      res = await doFetch(`/api/tables/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: saveBody(doc),
      });
    } catch {
      return { status: "offline", message: OFFLINE_MESSAGE };
    }

    if (res.status === 409) {
      /* A peer saved a newer revision. Pull their `updatedAt` and rebase the
         token only — the local grid and stickers are unsaved work. */
      let latest: { updatedAt?: unknown } | null = null;
      try {
        const latestRes = await doFetch(`/api/tables/${doc.id}`);
        latest = latestRes.ok ? ((await latestRes.json())?.table ?? null) : null;
      } catch {
        return { status: "offline", message: OFFLINE_MESSAGE };
      }
      if (isCancelled()) return { status: "cancelled" };
      if (!latest || typeof latest.updatedAt !== "string") {
        return { status: "offline", message: OFFLINE_MESSAGE };
      }

      adoptToken(latest.updatedAt);
      if (attempt + 1 < Math.max(1, maxAttempts)) continue; // retry with their token
      return { status: "conflict", message: CONFLICT_MESSAGE };
    }

    if (!res.ok) {
      return { status: "rejected", message: await errorMessage(res, "Your last change didn't save") };
    }

    /* Adopt the token the server just issued. Without this the next save
       replays a stale token and conflicts with our own previous write. */
    const saved = await res.json().catch(() => null);
    const newToken = saved?.table?.updatedAt;
    if (!isCancelled() && typeof newToken === "string") adoptToken(newToken);
    if (isCancelled()) return { status: "cancelled" };
    return attempt > 0 ? { status: "rebased", message: REBASE_MESSAGE } : { status: "saved" };
  }

  /* Unreachable: the loop always returns on its final attempt. */
  return { status: "conflict", message: CONFLICT_MESSAGE };
}
