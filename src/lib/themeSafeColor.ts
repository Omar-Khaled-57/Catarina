/**
 * themeSafeColor — theme-aware section colors that stay readable in both
 * themes, wherever a stored section hex is rendered as text, a graphic, or
 * a solid fill:
 *
 *  - text   — must clear 4.5:1 on neutral + tinted surfaces (textarea chips)
 *  - graphic — must clear 3:1 (icons, bars, donut slices, tint chips)
 *  - pill   — solid section-color buttons/pills: choose a dark ink or white
 *             foreground from the blended background's luminance
 *
 * Dark mode keeps the vivid palette but LIFTS only the hues that are too
 * close to their own background (violet #7C3AED is the offender), blending
 * toward white just enough to clear the required bar. Light mode blends every
 * hue 55% toward #0F1420 (dark steel), which both deepens the weave and turns
 * every section color into a 6–12:1 accessible ink on pale surfaces.
 */

import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

const LIGHT_OVERLAY = "#0F1420" as const;
/** Blend weight toward the overlay in light mode (0 = keep, 1 = fully overlay). */
const LIGHT_BLEND = 0.55;
/** Dark bg (#0B151F ≈ L 0.013) + 4.5:1 → min text luminance 0.23. */
const TEXT_DARK_MIN_L = 0.26;
/** Dark accent-tinted surfaces (≈ L 0.014) + 3:1 → min graphic luminance. */
const GRAPHIC_DARK_MIN_L = 0.16;
/** Pills: below this, white text; above it, the dark ink. */
const PILL_INK_THRESHOLD = 0.2;
const DARK_INK = "#060B14" as const;

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

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"),
      )
      .join("")
  );
}

function rgbLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? rgbLuminance(rgb) : 0;
}

export function blendToward(
  hex: string,
  target: string,
  amount: number,
): string {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  if (!from || !to) return hex;
  const rgb: [number, number, number] = [
    from[0] * (1 - amount) + to[0] * amount,
    from[1] * (1 - amount) + to[1] * amount,
    from[2] * (1 - amount) + to[2] * amount,
  ];
  return toHex(rgb);
}

function liftTowardWhite(hex: string, minL: number): string {
  const from = hexToRgb(hex);
  if (!from || rgbLuminance(from) >= minL) return hex;
  for (let t = 0.02; t <= 1; t += 0.02) {
    const rgb: [number, number, number] = [
      from[0] * (1 - t) + 255 * t,
      from[1] * (1 - t) + 255 * t,
      from[2] * (1 - t) + 255 * t,
    ];
    if (rgbLuminance(rgb) >= minL) return toHex(rgb);
  }
  return "#ffffff";
}

function lightSafe(hex: string): string {
  return blendToward(hex, LIGHT_OVERLAY, LIGHT_BLEND);
}

export function themeSafeColor(hex: string, isDark: boolean): string {
  return isDark ? hex : lightSafe(hex);
}

export function themeSafeTextColor(hex: string, isDark: boolean): string {
  return isDark ? liftTowardWhite(hex, TEXT_DARK_MIN_L) : lightSafe(hex);
}

export function themeSafeGraphicColor(hex: string, isDark: boolean): string {
  return isDark ? liftTowardWhite(hex, GRAPHIC_DARK_MIN_L) : lightSafe(hex);
}

export function themeSafePill(
  hex: string,
  isDark: boolean,
): { bg: string; fg: string } {
  const bg = isDark ? hex : lightSafe(hex);
  const fg =
    rgbLuminance(hexToRgb(bg) ?? [0, 0, 0]) < PILL_INK_THRESHOLD
      ? "#ffffff"
      : DARK_INK;
  return { bg, fg };
}

export function useThemeSafeColor(hex: string): string {
  const { isDark } = useTheme();
  return useMemo(() => themeSafeColor(hex, isDark), [hex, isDark]);
}

export function useThemeSafeTextColor(hex: string): string {
  const { isDark } = useTheme();
  return useMemo(() => themeSafeTextColor(hex, isDark), [hex, isDark]);
}

/** Drawers alias kept for backward compatibility with existing imports. */
export const useThemeSafeGlyphColor = useThemeSafeGraphicColor;

export function useThemeSafeGraphicColor(hex: string): string {
  const { isDark } = useTheme();
  return useMemo(() => themeSafeGraphicColor(hex, isDark), [hex, isDark]);
}

export function useThemeSafePill(
  hex: string,
): { bg: string; fg: string } {
  const { isDark } = useTheme();
  return useMemo(() => themeSafePill(hex, isDark), [hex, isDark]);
}