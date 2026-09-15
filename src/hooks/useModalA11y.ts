"use client";

/**
 * useModalA11y — Shared accessibility behavior for modal dialogs:
 * - Escape key to close (only when this dialog is the top of the shared
 *   modal stack, so stacked dialogs close one per keypress)
 * - body scroll lock while open
 * - focus first focusable element on open (top dialog only)
 * - trap Tab focus inside the dialog (top dialog only)
 * - restore focus to the previously focused element on close
 *
 * Returns a ref to attach to the dialog element.
 */
import { useEffect, useRef } from "react";
import {
  pushModal,
  popModal,
  isTop,
  getFocusables,
} from "@/lib/modal-a11y";

export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Escape to close — only the top-most dialog reacts; scroll lock is
     ref-counted across the shared modal stack. */
  useEffect(() => {
    if (!isOpen) return;
    const close = () => onClose();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop(close)) close();
    };
    pushModal({ close });
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      popModal({ close });
    };
  }, [isOpen, onClose]);

  /* Focus management */
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const close = () => onClose();

    const focusable = getFocusables(dialog);
    const first = focusable[0];
    if (isTop(close) && first) first.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      /* Only the top-most dialog traps the keyboard. */
      if (!isTop(close)) return;
      const items = getFocusables(dialogRef.current);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", handleTab);

    return () => {
      window.removeEventListener("keydown", handleTab);
      const active = document.activeElement as HTMLElement | null;
      if (dialog.contains(active)) previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  return dialogRef;
}