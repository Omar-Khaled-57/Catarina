"use client";

/**
 * SectionDropdown — Custom accessible dropdown for selecting a team section.
 * Features keyboard navigation, section color accents, and ARIA listbox pattern.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { type SectionData } from "@/types";
import { Palette, Code2, Users, ChevronDown, Check, Activity } from "lucide-react";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  MARKETING: <Activity size={16} />,
  ART: <Palette size={16} />,
  TECHNICAL: <Code2 size={16} />,
  MANAGEMENT: <Users size={16} />,
};

interface SectionDropdownProps {
  value: string;
  onChange: (section: string) => void;
  sections: SectionData[];
}

export default function SectionDropdown({
  value,
  onChange,
  sections,
}: SectionDropdownProps) {
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
        aria-label={`Team section: ${currentSection.label}`}
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
          aria-activedescendant={focusedIndex >= 0 ? `section-option-${focusedIndex}` : undefined}
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
                id={`section-option-${index}`}
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
