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
    textMuted: "#5A7A99",
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
    border: "rgba(0,232,162,0.3)",
    text: "#060B14",
    textMuted: "#5A7A99",
    accent: "#00C47A",
    accent2: "#00E8A2",
    danger: "#E11D48",
    warning: "#D97706",
    marketing: "#E11D48",
    art: "#7C3AED",
    technical: "#3B82F6",
    management: "#D97706",
  },
} as const;

export type PdfTheme = keyof typeof PDF_PALETTE;
