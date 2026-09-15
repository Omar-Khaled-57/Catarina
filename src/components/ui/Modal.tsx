"use client";

/**
 * Modal — Overlay dialog with backdrop blur.
 * Uses React Portal to render into document.body, bypassing
 * backdrop-filter ancestors that break position:fixed.
 * Uses Framer Motion for enter/exit animations.
 * Supports stacked modals: Escape closes only the top-most dialog (one per
 * press), scroll-lock is ref-counted, and focus returns to the opener.
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

/* Global stack of open modals — top of stack is the dialog that receives
 * Escape (avoids closing multiple stacked dialogs on a single keypress). */
const modalStack: Array<{ close: () => void }> = [];

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleScrollHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nearThumb = e.clientX > rect.right - 12;
    el.dataset.hover = nearThumb ? "true" : "";
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount tracking for SSR hydration safety
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = modalStack[modalStack.length - 1];
      if (top) top.close();
    };
    window.addEventListener("keydown", handleKey);

    /* Register this dialog as the newest (top-most). Scroll lock is
     * ref-counted across all open modals, and focus is restored to the
     * opener only when this dialog still owns focus (so closing a lower
     * modal never steals focus from one opened above it). */
    const close = () => onCloseRef.current();
    modalStack.push({ close });
    if (modalStack.length === 1) {
      document.documentElement.style.scrollbarGutter = "stable";
      document.body.style.overflow = "hidden";
    }
    const opener = document.activeElement as HTMLElement | null;
    const dialogEl = dialogRef.current;

    return () => {
      const idx = modalStack.findIndex((m) => m.close === close);
      const own = idx >= 0 ? modalStack[idx] : null;
      if (idx >= 0) modalStack.splice(idx, 1);
      if (own) {
        const active = document.activeElement as HTMLElement | null;
        const inThisDialog = dialogEl?.contains(active);
        if (
          inThisDialog &&
          opener &&
          document.body.contains(opener)
        ) {
          opener.focus();
        }
      }
      if (modalStack.length === 0) {
        document.body.style.overflow = "";
        document.documentElement.style.scrollbarGutter = "";
      }
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = dialog.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusable[0];
    if (first) {
      first.focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (!dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.key !== "Tab") return;

      if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
            className={`relative rounded-2xl bg-surface border border-border/60 ${maxWidth} w-full max-h-[90vh] flex flex-col`}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              {title && (
                <h2 className="text-xl sm:text-2xl font-bold text-text truncate">{title}</h2>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors shrink-0 ms-2"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="px-5 pb-5 overflow-y-auto modal-scroll"
              onMouseMove={handleScrollHover}
              onMouseLeave={() => {
                if (scrollRef.current) scrollRef.current.dataset.hover = "";
              }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
