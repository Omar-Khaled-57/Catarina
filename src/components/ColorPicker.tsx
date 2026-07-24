"use client";

/**
 * ColorPicker — Stylized color picker with premade palette and custom color slots.
 * Supports up to 10 custom colors saved to localStorage.
 */

import { useState, useRef } from "react";
import { Palette, Plus, X, Check } from "lucide-react";

const PREMADE_COLORS = [
  { name: "Rose", hex: "#FF4D6A" },
  { name: "Violet", hex: "#7C3AED" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Emerald", hex: "#00E8A2" },
  { name: "Crimson", hex: "#E11D48" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Pink", hex: "#EC4899" },
];

const CUSTOM_COLORS_KEY = "catarina-custom-colors";
const MAX_CUSTOM_COLORS = 10;

function loadCustomColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomColors(colors: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
}

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newColor, setNewColor] = useState("#00E8A2");
  const pickerRef = useRef<HTMLInputElement>(null);

  const addCustomColor = () => {
    if (customColors.length >= MAX_CUSTOM_COLORS) return;
    if (customColors.includes(newColor)) return;
    const updated = [...customColors, newColor];
    setCustomColors(updated);
    saveCustomColors(updated);
    onChange(newColor);
  };

  const removeCustomColor = (hex: string) => {
    const updated = customColors.filter((c) => c !== hex);
    setCustomColors(updated);
    saveCustomColors(updated);
  };

  return (
    <div className="space-y-3">
      {/* Premade palette */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
          Premade Colors
        </label>
        <div className="flex flex-wrap gap-2">
          {PREMADE_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              className="group relative h-9 w-9 rounded-xl transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg"
              style={{
                backgroundColor: c.hex,
                boxShadow: value === c.hex ? `0 0 0 2px var(--bg), 0 0 0 4px ${c.hex}` : "none",
              }}
              title={c.name}
            >
              {value === c.hex && (
                <Check size={14} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom colors */}
      {customColors.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Your Custom Colors ({customColors.length}/{MAX_CUSTOM_COLORS})
          </label>
          <div className="flex flex-wrap gap-2">
            {customColors.map((hex) => (
              <div key={hex} className="group relative">
                <button
                  type="button"
                  onClick={() => onChange(hex)}
                  className="h-9 w-9 rounded-xl transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg"
                  style={{
                    backgroundColor: hex,
                    boxShadow: value === hex ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}` : "none",
                  }}
                >
                  {value === hex && (
                    <Check size={14} className="mx-auto text-white" strokeWidth={3} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeCustomColor(hex)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced color picker */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:text-accent-2 transition-colors"
        >
          <Palette size={12} />
          {showAdvanced ? "Hide" : "Custom Color"}{customColors.length < MAX_CUSTOM_COLORS ? "" : " (max reached)"}
        </button>

        {showAdvanced && (
          <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-surface-2/60 border border-border/40">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                ref={pickerRef}
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-9 rounded-lg cursor-pointer border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={newColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setNewColor(val);
                }}
                className="flex-1 min-w-0 rounded-lg bg-surface border border-border/40 px-3 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
                placeholder="#000000"
                maxLength={7}
              />
            </div>
            <button
              type="button"
              onClick={addCustomColor}
              disabled={customColors.length >= MAX_CUSTOM_COLORS || customColors.includes(newColor)}
              className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={12} />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
