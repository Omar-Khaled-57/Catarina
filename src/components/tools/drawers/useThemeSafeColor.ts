"use client";

/**
 * useThemeSafeColor — return a section color that stays accessible on the
 * drawers' colored surfaces in both themes.
 *
 * In dark mode the vivid palette is used as-is: white on 32% color / steel
 * faces clears 4.5:1 and the section glyphs pass 3:1 on the dark backdrop.
 * In light mode any arbitrary registry hex is pushed 55% toward a dark steel
 * so that (a) the derived chest faces stay dark enough for a white name label
 * (≥4.5:1) and (b) the same shade passes 4.5:1 as text and 3:1 as iconography
 * on the pale workspace — regardless of how bright the stored color is.
 */

import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

/** Dark overlay blended over section colors in light mode. */
const LIGHT_OVERLAY = "#0F1420";
/** Blend weight toward the overlay (0 = keep the color, 1 = fully overlay). */
const LIGHT_BLEND = 0.55;
/**
 * Minimum relative luminance for a section glyph in dark mode so it clears
 * 3:1 (WCAG 1.4.11 non-text contrast) against the darkest drawer surface
 * (≈L 0.013) and the accent-tinted tiles used for active/hover rows
 * (≈L 0.014). Colors below it (e.g. violet #7C3AED) are lightened toward
 * white just enough to clear the bar.
 */
const GLYPH_DARK_MIN_L = 0.155;

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function blendToward(hex: string, target: string, amount: number): string {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  if (!from || !to) return hex;
  const channels = from.map((c, i) =>
    Math.round(c * (1 - amount) + to[i] * amount),
  );
  return (
    "#" +
    channels
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function useThemeSafeColor(hex: string): string {
  const { isDark } = useTheme();
  return useMemo(() => {
    if (isDark) return hex;
    return blendToward(hex, LIGHT_OVERLAY, LIGHT_BLEND);
  }, [hex, isDark]);
}

function liftForDarkMode(hex: string): string {
  const from = hexToRgb(hex);
  if (!from || relativeLuminance(from) >= GLYPH_DARK_MIN_L) return hex;
  for (let t = 0.02; t <= 1; t += 0.02) {
    const rgb: [number, number, number] = [
      from[0] * (1 - t) + 255 * t,
      from[1] * (1 - t) + 255 * t,
      from[2] * (1 - t) + 255 * t,
    ];
    if (relativeLuminance(rgb) >= GLYPH_DARK_MIN_L) return toHex(rgb);
  }
  return "#ffffff";
}

/**
 * useThemeSafeGlyphColor — for section icons/graphics scattered over the
 * directory panels. In light mode it darkens (same as useThemeSafeColor); in
 * dark mode it keeps vivid colors but lifts any shade too close to its
 * background to pass 3:1 (only the darkest palette colors, e.g. violet,
 * are affected) so the glyph stays recognizable and accessible everywhere.
 */
export function useThemeSafeGlyphColor(hex: string): string {
  const { isDark } = useTheme();
  return useMemo(() => {
    if (isDark) return liftForDarkMode(hex);
    return blendToward(hex, LIGHT_OVERLAY, LIGHT_BLEND);
  }, [hex, isDark]);
}