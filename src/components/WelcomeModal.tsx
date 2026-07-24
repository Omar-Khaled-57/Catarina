"use client";

/**
 * WelcomeModal — Celebration shown on first login after admin approval.
 * Uses celebration.webp with bounce animation.
 */

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

export default function WelcomeModal() {
  const { user, markWelcomeSeen } = useAuth();

  const show = user && !user.welcomeSeen;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={markWelcomeSeen}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="relative glass rounded-3xl p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouncing celebration image */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/rina/celebration.webp"
                alt="Catarina celebrating"
                width={160}
                height={200}
                className="mx-auto drop-shadow-xl"
                style={{ width: "clamp(120px, 35vw, 160px)", height: "auto" }}
                priority
              />
            </motion.div>

            <h2 className="text-2xl font-black text-text mt-4 mb-2">
              Welcome to Catarina!
            </h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              Your account has been approved. You&apos;re now part of the team.
              Start by setting your goals and tracking your progress.
            </p>

            <button
              onClick={markWelcomeSeen}
              className="w-full py-3 rounded-xl bg-accent text-bg font-bold text-sm hover:bg-accent-2 transition-colors"
            >
              Let&apos;s Go!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
