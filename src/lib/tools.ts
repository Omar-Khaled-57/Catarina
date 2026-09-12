/**
 * Tool Registry — single source of truth for every Cabinet tool card.
 * Adding a tool here is enough to surface its card on /tools (and nav label).
 */

import { Archive, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToolStatus = "live" | "coming-soon";

export interface ToolMeta {
  id: string;
  name: string;
  tagline: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  status: ToolStatus;
  comingSoonNote?: string;
}

export const CABINET_LABEL = "Cabinet";
export const COMING_SOON_TEXT = "Coming soon — Catarina is building this";

const TOOL_REGISTRY: ToolMeta[] = [
  {
    id: "drawers",
    name: "Drawers",
    tagline:
      "Shared compartments full of reusable stuff — code, notes, links, files — pin any of it to a goal.",
    href: "/tools/drawers",
    icon: Archive,
    accent: "#7C3AED",
    status: "live",
  },
  {
    id: "table",
    name: "Table",
    tagline:
      "One free-form team grid — merge cells, mark dates, drop stickers, and export a themed PDF.",
    href: "/tools/tables",
    icon: Table2,
    accent: "#F59E0B",
    status: "live",
  },
];

export function getTools(): ToolMeta[] {
  const live = TOOL_REGISTRY.filter((t) => t.status === "live");
  const soon = TOOL_REGISTRY.filter((t) => t.status === "coming-soon");
  return [...live, ...soon];
}