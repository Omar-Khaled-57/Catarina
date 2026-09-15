"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab / Shift+Tab cycling inside `containerRef` while `active` is true.
 * Modal convention: focus never leaks out of a dialog to the page behind it.
 *
 * The listener is attached to `window` so that the outside-focus recapture
 * branch works even when focus escapes the container entirely (e.g. after an
 * element unmounts or after a programmatic `.focus()` call).  Visibility is
 * checked via `getClientRects()` instead of `offsetParent` to support
 * `position: fixed` elements.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getClientRects().length > 0,
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      const inside = activeEl ? container.contains(activeEl) : false;

      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}
