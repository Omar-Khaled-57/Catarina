"use client";

/**
 * LoginForm — Client component handling email/password authentication.
 * Extracted from login page to allow the page itself to be a Server Component.
 * Hodor-inspired design with neon glow effects.
 * Smooth morph animation between sign-in and sign-up forms.
 * Custom stylized team section dropdown with section colors.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import SectionDropdown from "@/components/SectionDropdown";
import { FALLBACK_SECTIONS } from "@/types";
import { toast } from "sonner";
import Image from "next/image";

interface DynamicSection {
  key: string;
  label: string;
  color: string;
  prefix: string;
}

/* Shared field transition config */
const FIELD_TRANSITION = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const,
};

/* Card morph — slower so it settles in sync with field collapse */
const CARD_MORPH = {
  layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LoginForm() {
  const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";
  const router = useRouter();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<DynamicSection[]>(FALLBACK_SECTIONS);

  /* Fetch dynamic sections */
  useEffect(() => {
    fetch("/api/sections")
      .then((r) => r.json())
      .then((data) => {
        if (data.sections?.length) {
          setSections(data.sections.map((s: DynamicSection) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            prefix: s.prefix,
          })));
        }
      })
      .catch(() => {
        /* Falls back to FALLBACK_SECTIONS — non-critical */
      });
  }, []);

  /* Form state */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<string>(FALLBACK_SECTIONS[0].key);
  const [pfp, setPfp] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegister) {
        const result = await register(name, email, password, section, pfp);
        if (result.success) {
          toast.success("Account request submitted! An admin will review it shortly.");
          setIsRegister(false);
        } else {
          toast.error(result.error || "Registration failed");
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          toast.success("Welcome back!");
          router.push("/dashboard");
        } else {
          toast.error(result.error || "Invalid email or password");
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => setIsRegister((prev) => !prev);

  return (
    <div id="main-content" className="flex min-h-screen items-center justify-center p-4 pt-16 pb-48">
      {/* Background glow effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image src="/icons/logo.webp" alt="Catarina Logo" width={120} height={120} className="w-[80px] min-w-[80px] sm:w-[120px] sm:min-w-[120px] h-[80px] sm:h-[120px] mx-auto object-contain mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-black text-text tracking-tight">Catarina</h1>
          <p className="text-text-muted mt-1">{teamName} Team Planner</p>
        </motion.div>

        {/* Form Card */}
        <motion.div className="glass rounded-2xl p-6" layout transition={CARD_MORPH}>
          {/* Title */}
          <AnimatePresence mode="wait">
            <motion.h2
              key={isRegister ? "register" : "login"}
              className="text-xl font-bold text-text mb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {isRegister ? "Create Account" : "Sign In"}
            </motion.h2>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name — register only */}
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1, height: "auto", marginBottom: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98, height: 0, marginBottom: 0 }}
                  transition={FIELD_TRANSITION}
                  style={{ overflow: "hidden" }}
                >
                  <div>
                    <label htmlFor="login-name" className="block text-sm font-medium text-text-muted mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="login-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required={isRegister}
                      className="w-full rounded-xl bg-surface-2 border border-border px-4 pb-3 pt-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="pt-2">
              <label htmlFor="login-email" className="block text-sm font-medium text-text-muted mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Section — register only (no overflow: hidden so dropdown can push height) */}
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="section-field"
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1, height: "auto", marginBottom: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98, height: 0, marginBottom: 0 }}
                  transition={FIELD_TRANSITION}
                >
                  <div className="relative">
                    <SectionDropdown value={section} onChange={setSection} sections={sections} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PFP — register only (optional) */}
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="pfp-field"
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1, height: "auto", marginBottom: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98, height: 0, marginBottom: 0 }}
                  transition={FIELD_TRANSITION}
                  style={{ overflow: "hidden" }}
                  className="mt-4"
                >
                  <div>
                    <label htmlFor="login-pfp" className="block text-sm font-medium text-text-muted mb-1.5">
                      Profile Picture <span className="text-text-muted/60">(optional)</span>
                    </label>
                    <input
                      id="login-pfp"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => setPfp(e.target.files?.[0] || null)}
                      className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent transition-colors file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.div layout transition={CARD_MORPH} className="mt-4">
              <Button type="submit" isLoading={isLoading} className="w-full relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={isRegister ? "create" : "signin"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-flex items-center gap-2"
                  >
              {isRegister ? "Request Access" : "Sign In"}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </form>

          {/* Toggle */}
          <motion.div layout transition={CARD_MORPH} className="mt-4 text-center text-sm text-text-muted">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={toggleMode}
              className="font-semibold text-accent hover:underline"
            >
              {isRegister ? "Sign In" : "Register"}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
