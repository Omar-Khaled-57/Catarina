"use client";

/**
 * UpdateModal — Celebration modal shown when a new version is deployed.
 * Tiered intensity based on update type:
 *   major  → full confetti + celebration.webp bouncing
 *   minor  → subtle particles + excited.webp bounce
 *   patch  → clean card + happy.webp fade-in
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useModalA11y } from "@/hooks/useModalA11y";

interface ChangelogEntry {
  icon: string;
  text: string;
}

interface UpdateModalProps {
  version: string;
  type: "major" | "minor" | "patch";
  title: string;
  entries: ChangelogEntry[];
  onDismiss: () => void;
}

/* ─── Confetti particle (major only) ──────────────────────────────────────── */

function ConfettiParticle({ delay, seed }: { delay: number; seed: number }) {
  const colors = ["#00E8A2", "#FF4D6A", "#7C3AED", "#3B82F6", "#F59E0B"];
  const color = colors[seed % colors.length];
  const x = (seed * 13.37) % 100;
  const rotation = (seed * 7.91) % 360;
  const size = 6 + (seed % 6);

  return (
    <motion.div
      initial={{ y: -20, x: `${x}vw`, opacity: 1, rotate: 0 }}
      animate={{ y: "100vh", opacity: 0, rotate: rotation + 720 }}
      transition={{ duration: 2.5 + (seed % 15) / 10, delay, ease: "easeIn" }}
      className="fixed top-0 pointer-events-none z-[201]"
      style={{ left: `${x}%` }}
    >
      <div
        style={{
          width: size,
          height: size * 0.6,
          background: color,
          borderRadius: 2,
        }}
      />
    </motion.div>
  );
}

/* ─── Floating subtle particles (minor only) ──────────────────────────────── */

function FloatingDot({ delay, seed }: { delay: number; seed: number }) {
  const color = "#00E8A2";
  const x = 20 + (seed * 5.73) % 60;
  const size = 3 + (seed % 3);

  return (
    <motion.div
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -60, opacity: [0, 0.4, 0] }}
      transition={{ duration: 2, delay, repeat: Infinity, repeatDelay: 1 + (seed % 20) / 10 }}
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, bottom: 0 }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: color,
          borderRadius: "50%",
        }}
      />
    </motion.div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

const IMAGE_MAP: Record<string, string> = {
  major: "/rina/celebration.webp",
  minor: "/rina/excited.webp",
  patch: "/rina/happy.webp",
};

const IMAGE_SIZE: Record<string, { width: number; style: React.CSSProperties }> = {
  major: { width: 160, style: { width: "clamp(120px, 35vw, 160px)", height: "auto" } },
  minor: { width: 130, style: { width: "clamp(100px, 30vw, 130px)", height: "auto" } },
  patch: { width: 96, style: { width: "clamp(80px, 24vw, 96px)", height: "auto" } },
};

const CONFETTI_COUNT = 40;
const DOTS_COUNT = 8;

export default function UpdateModal({
  version,
  type,
  title,
  entries,
  onDismiss,
}: UpdateModalProps) {
  const [show, setShow] = useState(false);
  const [confettiDone, setConfettiDone] = useState(false);

  useEffect(() => {
    /* Slight delay so auth settles first */
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const dialogRef = useModalA11y(show, handleDismiss);

  const imgSrc = IMAGE_MAP[type];
  const imgSize = IMAGE_SIZE[type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleDismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

          {/* Confetti — major only */}
          {type === "major" && !confettiDone && (
            <>
              {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                <ConfettiParticle key={i} delay={i * 0.04} seed={i * 31 + 7} />
              ))}
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 4, delay: 0.5 }}
                onAnimationComplete={() => setConfettiDone(true)}
                className="absolute inset-0 pointer-events-none z-[201]"
              />
            </>
          )}

          {/* Floating dots — minor only */}
          {type === "minor" && (
            <div className="absolute inset-0 pointer-events-none z-[201] overflow-hidden">
              {Array.from({ length: DOTS_COUNT }).map((_, i) => (
                <FloatingDot key={i} delay={i * 0.3} seed={i * 17 + 3} />
              ))}
            </div>
          )}

          {/* Card */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-modal-title"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="relative glass rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Version badge */}
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full font-mono mb-4">
              v{version}
            </div>

            {/* Image */}
            <motion.div
              animate={
                type === "major"
                  ? { y: [0, -12, 0] }
                  : type === "minor"
                    ? { y: [0, -6, 0] }
                    : {}
              }
              transition={{
                duration: type === "major" ? 1.8 : 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src={imgSrc}
                alt="Catarina"
                width={imgSize.width}
                height={imgSize.width}
                className="mx-auto drop-shadow-xl"
                style={imgSize.style}
                priority
              />
            </motion.div>

            {/* Title */}
            <h2 id="update-modal-title" className="text-lg sm:text-xl font-black text-text mt-4 mb-3">
              {title}
            </h2>

            {/* Changelog entries */}
            <div className="text-left space-y-2.5 mb-6 max-h-48 overflow-y-auto pr-1 modal-scroll">
              {entries.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-2.5 text-sm text-text-muted"
                >
                  <span className="text-base flex-shrink-0 mt-px">{entry.icon}</span>
                  <span className="leading-relaxed">{entry.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl bg-accent text-bg font-bold text-sm hover:bg-accent-2 transition-colors"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
