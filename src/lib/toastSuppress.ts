/**
 * Shared flag to suppress the next incoming-change toast.
 * Set this after a successful mutation so the Navbar doesn't toast
 * for the user's own action.
 */
let _suppress = false;

export function suppressNextToast() {
  _suppress = true;
}

export function consumeSuppress(): boolean {
  if (_suppress) {
    _suppress = false;
    return true;
  }
  return false;
}
