/**
 * PDF color palettes for dark/light mode report export.
 * Mirrors globals.css color tokens.
 */
export const PDF_PALETTE = {
  dark: {
    bg: "#060B14",
    surface: "#0D1824",
    surface2: "#142035",
    border: "rgba(0,232,162,0.15)",
    text: "#F0F6FF",
    textMuted: "#6B90B3",
    accent: "#00E8A2",
    accent2: "#00C87A",
    danger: "#FF4D6A",
    warning: "#FFB830",
    marketing: "#FF4D6A",
    art: "#7C3AED",
    technical: "#3B82F6",
    management: "#F59E0B",
  },
  light: {
    bg: "#F0F6FF",
    surface: "#FFFFFF",
    surface2: "#E2E8F0",
    border: "rgba(0,116,73,0.25)",
    text: "#060B14",
    textMuted: "#4A6A8C",
    accent: "#007449",
    accent2: "#00A36C",
    danger: "#C1123C",
    warning: "#B45309",
    marketing: "#0E7490",
    art: "#6D28D9",
    technical: "#1D4ED8",
    management: "#92400E",
  },
} as const;

export type PdfTheme = keyof typeof PDF_PALETTE;
