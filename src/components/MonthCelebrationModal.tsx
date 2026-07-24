"use client";

/**
 * MonthCelebrationModal — Big centered celebration modal for finishing a month.
 * Triggered when a MONTH_CREATED or GOALS_CARRIED_OVER notification is seen.
 * Features: celebration.webp (full body), confetti particles, X close button.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Sparkles, Trophy, Star } from "lucide-react";

interface MonthCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthName?: string;
}

/* Confetti particle — purely CSS-animated via framer-motion */
function ConfettiParticle({
  x,
  y,
  color,
  delay,
  size,
  rotation,
}: {
  x: number;
  y: number;
  color: string;
  delay: number;
  size: number;
  rotation: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `-${size * 2}px`,
        width: size,
        height: size * 0.5,
        backgroundColor: color,
        borderRadius: "2px",
      }}
      initial={{ y: -20, opacity: 1, rotate: rotation }}
      animate={{
        y: `${y}vh`,
        opacity: [1, 1, 0.8, 0],
        rotate: rotation + 720,
      }}
      transition={{
        duration: 2.8 + Math.random() * 1.2,
        delay,
        ease: "easeIn",
        repeat: Infinity,
        repeatDelay: 1,
      }}
    />
  );
}

const CONFETTI_COLORS = [
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#3b82f6",
  "#f97316",
  "#a855f7",
  "#14b8a6",
];

export default function MonthCelebrationModal({
  isOpen,
  onClose,
  monthName,
}: MonthCelebrationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Escape key to close */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;

  /* Generate 32 confetti pieces */
  const confetti = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: 90 + Math.random() * 40,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 2,
    size: 8 + Math.random() * 10,
    rotation: Math.random() * 360,
  }));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Month Celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Confetti layer */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            {confetti.map((p) => (
              <ConfettiParticle key={p.id} {...p} />
            ))}
          </div>

          {/* Modal card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
            className="relative z-10 w-full max-w-sm sm:max-w-md rounded-3xl bg-surface border border-border/60 shadow-2xl overflow-hidden"
          >
            {/* Glowing rainbow accent bar */}
            <div
              className="h-1.5 w-full"
              style={{
                background:
                  "linear-gradient(90deg, #f59e0b, #ec4899, #6366f1, #10b981)",
              }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close celebration"
              className="absolute top-3 right-3 z-20 rounded-full p-2 bg-surface-2/80 text-text-muted hover:bg-surface-2 hover:text-text transition-all"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="px-6 pt-5 pb-7 flex flex-col items-center text-center gap-4">
              {/* Stars / trophy row */}
              <div className="flex items-center gap-2 text-amber-400">
                <motion.div
                  animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                >
                  <Star size={18} fill="currentColor" />
                </motion.div>
                <motion.div
                  animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.3, 1] }}
                  transition={{
                    duration: 1.5,
                    delay: 0.2,
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                >
                  <Trophy size={20} fill="currentColor" />
                </motion.div>
                <motion.div
                  animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1.5,
                    delay: 0.4,
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                >
                  <Star size={18} fill="currentColor" />
                </motion.div>
              </div>

              {/* Celebration image — full body, responsive sizing */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <Image
                  src="/rina/celebration.webp"
                  alt="Catarina celebrating"
                  width={180}
                  height={220}
                  className="mx-auto drop-shadow-xl"
                  style={{
                    width: "clamp(130px, 38vw, 180px)",
                    height: "auto",
                  }}
                  priority
                />
                {/* Glow ring under Rina */}
                <motion.div
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full"
                  style={{
                    background:
                      "radial-gradient(ellipse, rgba(245,158,11,0.35), transparent)",
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>

              {/* Headline */}
              <div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl sm:text-3xl font-black text-text leading-tight"
                >
                  🎉 Month Complete!
                </motion.h2>
                {monthName && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-sm font-semibold text-text-muted mt-1"
                  >
                    {monthName}
                  </motion.p>
                )}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-text-muted mt-2 leading-relaxed max-w-xs mx-auto"
                >
                  Another month wrapped up — time to celebrate the team&apos;s hard
                  work! 🌟
                </motion.p>
              </div>

              {/* Sparkle tagline */}
              <motion.div
                className="flex items-center gap-1.5 text-text-muted text-xs font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Sparkles size={13} className="text-amber-400" />
                New month is ready — keep going!
                <Sparkles size={13} className="text-amber-400" />
              </motion.div>

              {/* CTA button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="mt-1 px-8 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #ec4899)",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
                }}
              >
                Let&apos;s go! 🚀
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
