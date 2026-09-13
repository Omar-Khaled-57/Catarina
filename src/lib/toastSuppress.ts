/**
 * Shared flag to suppress the next incoming-change toast.
 * Set this after a successful mutation so the Navbar doesn't toast
 * for the user's own action.
 *
 * The flag expires after SUPPRESS_TTL_MS so an unconsumed set can't linger
 * and swallow an unrelated toast much later.
 */
let _suppressAt = 0;
const SUPPRESS_TTL_MS = 5000;

export function suppressNextToast() {
  _suppressAt = Date.now();
}

export function consumeSuppress(): boolean {
  const fresh = Date.now() - _suppressAt <= SUPPRESS_TTL_MS;
  _suppressAt = 0;
  return fresh;
}
