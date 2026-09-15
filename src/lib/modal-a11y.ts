/**
 * Modal stack — shared ordering for every dialog on the page (ui/Modal and
 * custom dialogs via useModalA11y). Only the TOP dialog reacts to Escape and
 * traps Tab, so stacked dialogs close one per keypress instead of all at once,
 * and a lower dialog never steals focus back from one opened above it.
 */

export interface StackEntry {
  close: () => void;
}

export const modalStack: StackEntry[] = [];

export function topEntry(): StackEntry | undefined {
  return modalStack[modalStack.length - 1];
}

export function isTop(close: () => void): boolean {
  return topEntry()?.close === close;
}

export function pushModal(entry: StackEntry): void {
  modalStack.push(entry);
  if (modalStack.length === 1) {
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
  }
}

export function popModal(entry: StackEntry): void {
  const idx = modalStack.findIndex((m) => m.close === entry.close);
  if (idx >= 0) modalStack.splice(idx, 1);
  if (modalStack.length === 0) {
    document.body.style.overflow = "";
    document.documentElement.style.scrollbarGutter = "";
  }
}

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled"),
  );
}