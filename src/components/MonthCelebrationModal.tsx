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
import { X, Sparkles, Trophy, Star, Rocket } from "lucide-react";
import { useModalA11y } from "@/hooks/useModalA11y";

interface MonthCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthName?: string;
}

/** Simple deterministic PRNG — seedable, no Math.random() at render time */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
  /* Deterministic duration per particle based on index-derived seed */
  const rand = seededRandom(rotation);
  const duration = 2.8 + rand() * 1.2;

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
        duration,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount tracking for SSR hydration safety
    setMounted(true);
  }, []);

  /* Shared a11y: Escape, scroll lock, focus trap, focus restore */
  const dialogRef = useModalA11y(isOpen, onClose);

  if (!mounted) return null;

  /* Generate 32 confetti pieces (deterministic — no Math.random at render) */
  const rng = seededRandom(42);
  const confetti = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    x: rng() * 100,
    y: 90 + rng() * 40,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: rng() * 2,
    size: 8 + rng() * 10,
    rotation: rng() * 360,
  }));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="month-celebration-title"
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
                  "linear-gradient(90deg, #10b981, #14b8a6, #2dd4bf, #34d399)",
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
              <div className="flex items-center gap-2 text-warning">
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
                      "radial-gradient(ellipse, rgba(16,185,129,0.35), transparent)",
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>

              {/* Headline */}
              <div>
                <motion.h2
                  id="month-celebration-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-black text-text leading-tight"
                >
                  <Image
                    src="/rina/excited.webp"
                    alt="Catarina excited"
                    width={64}
                    height={64}
                    className="drop-shadow-lg"
                    style={{ width: "clamp(40px, 12vw, 64px)", height: "auto" }}
                  />
                  Month Complete!
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
                  work!{" "}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 96 96"
                    className="inline-block w-4 h-4 align-[-3px]"
                  >
                    <defs>
                      <symbol id="catarina-teal-star" viewBox="0 0 36 36">
                        <path
                          fill="#14b8a6"
                          d="M28.84 17.638c-.987 1.044-1.633 3.067-1.438 4.493l.892 6.441c.197 1.427-.701 2.087-1.996 1.469l-5.851-2.796c-1.295-.62-3.408-.611-4.7.018l-5.826 2.842c-1.291.629-2.193-.026-2.007-1.452l.843-6.449c.186-1.427-.475-3.444-1.47-4.481l-4.494-4.688c-.996-1.037-.655-2.102.755-2.365l6.37-1.188c1.41-.263 3.116-1.518 3.793-2.789L16.762.956c.675-1.271 1.789-1.274 2.473-.009L22.33 6.66c.686 1.265 2.4 2.507 3.814 2.758l6.378 1.141c1.412.252 1.761 1.314.774 2.359l-4.456 4.72z"
                        />
                        <path
                          fill="#5eead4"
                          d="M9.783 2.181c1.023 1.413 2.446 4.917 1.717 5.447-.728.531-3.607-1.91-4.63-3.323-1.022-1.413-.935-2.668-.131-3.254.804-.587 2.02-.282 3.044 1.13zm19.348 2.124C28.109 5.718 25.23 8.16 24.5 7.627c-.729-.53.695-4.033 1.719-5.445C27.242.768 28.457.463 29.262 1.051c.803.586.89 1.841-.131 3.254zM16.625 33.291c-.001-1.746.898-5.421 1.801-5.421.897 0 1.798 3.675 1.797 5.42 0 1.747-.804 2.712-1.8 2.71-.994.002-1.798-.962-1.798-2.709zm16.179-9.262c-1.655-.539-4.858-2.533-4.579-3.395.277-.858 4.037-.581 5.69-.041 1.655.54 2.321 1.605 2.013 2.556-.308.95-1.469 1.42-3.124.88zM2.083 20.594c1.655-.54 5.414-.817 5.694.044.276.857-2.928 2.854-4.581 3.392-1.654.54-2.818.07-3.123-.88-.308-.95.354-2.015 2.01-2.556z"
                        />
                      </symbol>
                    </defs>
                    <use
                      href="#catarina-teal-star"
                      x="0"
                      y="0"
                      width="96"
                      height="96"
                    />
                  </svg>
                </motion.p>
              </div>

              {/* Sparkle tagline */}
              <motion.div
                className="flex items-center gap-1.5 text-text-muted text-xs font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Sparkles size={13} className="text-accent" />
                New month is ready — keep going!
                <Sparkles size={13} className="text-accent" />
              </motion.div>

              {/* CTA button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="mt-1 px-8 py-2.5 rounded-xl font-bold text-sm text-bg"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                  boxShadow: "0 4px 20px var(--color-accent-glow)",
                }}
              >
                <span className="inline-flex items-center gap-2">
                  Let&apos;s go!
                  <Rocket size={15} />
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
