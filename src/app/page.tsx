"use client";

/**
 * Login Page — Entry point with email/password authentication.
 * Hodor-inspired design with neon glow effects.
 * Smooth morph animation between sign-in and sign-up forms.
 * Custom stylized team section dropdown with section colors.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { toast } from "sonner";
import { LayoutList, ChevronDown, Check, Activity, Palette, Code2, Users, ArrowRight, UserPlus, LogIn } from "lucide-react";
import Image from "next/image";

interface DynamicSection {
  key: string;
  label: string;
  color: string;
  prefix: string;
}

const FALLBACK_SECTIONS: DynamicSection[] = [
  { key: "MARKETING", label: "Marketing", color: "#FF4D6A", prefix: "MRK-" },
  { key: "ART", label: "Art", color: "#7C3AED", prefix: "ART-" },
  { key: "TECHNICAL", label: "Technical", color: "#3B82F6", prefix: "TEC-" },
  { key: "MANAGEMENT", label: "Management", color: "#F59E0B", prefix: "MNG-" },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  MARKETING: <Activity size={16} />,
  ART: <Palette size={16} />,
  TECHNICAL: <Code2 size={16} />,
  MANAGEMENT: <Users size={16} />,
};

/* Shared field transition config */
const FIELD_TRANSITION = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const,
};

/* Card morph — slower so it settles in sync with field collapse */
const CARD_MORPH = {
  layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LoginPage() {
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
          setSections(data.sections.map((s: any) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            prefix: s.prefix,
          })));
        }
      })
      .catch(() => {});
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
        const success = await login(email, password);
        if (success) {
          toast.success("Welcome back!");
          router.push("/dashboard");
        } else {
          toast.error("Invalid email or password");
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
          <Image src="/logo.webp" alt="Catarina Logo" width={100} height={100} className="h-25 w-25 mx-auto object-contain mb-4" />
          <h1 className="text-3xl font-black text-text tracking-tight">Catarina</h1>
          <p className="text-text-muted mt-1">Devora Team Planner</p>
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

/* ─── Custom Section Dropdown ─────────────────────────────────────────────── */
function SectionDropdown({
  value,
  onChange,
  sections,
}: {
  value: string;
  onChange: (section: string) => void;
  sections: DynamicSection[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  /* Keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < sections.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : sections.length - 1;
          return next;
        });
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < sections.length) {
          onChange(sections[focusedIndex].key);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const openMenu = () => {
    setIsOpen(true);
    setFocusedIndex(sections.findIndex((s) => s.key === value));
  };

  const currentSection = sections.find((s) => s.key === value) || sections[0];
  const color = currentSection.color;

  return (
    <div ref={ref} className="relative">
      <label htmlFor="login-section" className="block text-sm font-medium text-text-muted mb-1.5">
        Team Section
      </label>
      {/* Trigger */}
      <button
        id="login-section"
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-text flex items-center gap-3 focus:outline-none focus:border-accent transition-colors"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {SECTION_ICONS[value]}
        </span>
        <span className="flex-1 text-left font-medium">
          {currentSection.label}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown — absolute so it pushes page height, no clipping */}
      {isOpen && (
        <motion.div
          ref={listboxRef}
          role="listbox"
          aria-label="Team sections"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 right-0 mt-2 rounded-xl bg-surface border border-border shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden"
          style={{ zIndex: 50 }}
        >
          {sections.map((s, index) => {
            const c = s.color;
            const isSelected = s.key === value;
            const isFocused = index === focusedIndex;
            return (
              <button
                key={s.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(s.key);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isSelected ? "bg-accent/5" : isFocused ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: `${c}20`, color: c }}
                >
                  {SECTION_ICONS[s.key]}
                </span>
                <span className="flex-1 text-left font-medium text-text">
                  {s.label}
                </span>
                {isSelected && (
                  <Check size={16} className="text-accent shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
