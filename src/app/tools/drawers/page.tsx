/**
 * Drawers — /tools/drawers. Demo-first: renders the 3D chests (one per section)
 * with pull-out project drawers, envelopes and a focus-mode directory browser.
 * Data wiring comes next.
 */

import DrawersWorkshop from "@/components/tools/drawers/DrawersWorkshop";
import type { DemoSection } from "@/components/tools/drawers/types";

/* Offline SVG placeholder images so IMAGE items show a real preview in the
 * focus-mode browser and the chest thumbnails — no network needed. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const imgPlaceholder = (label: string, from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><circle cx="300" cy="150" r="52" fill="rgba(255,255,255,0.25)"/><rect x="190" y="206" width="220" height="16" rx="8" fill="rgba(255,255,255,0.9)"/><rect x="240" y="230" width="120" height="10" rx="5" fill="rgba(255,255,255,0.5)"/><text x="300" y="286" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="rgba(0,0,0,0.35)">${esc(label)}</text></svg>`.replace(
      /\n/g,
      "",
    ),
  )}`;

const DEMO_SECTIONS: DemoSection[] = [
  {
    key: "art",
    label: "Art",
    color: "#7C3AED",
    projects: [
      {
        id: "art-sprites",
        name: "Character Sprites",
        envelopes: [
          {
            id: "art-sprites-hero",
            name: "Hero poses",
            items: [
              { id: "hero-note", type: "NOTE", name: "Pose checklist" },
              {
                id: "hero-sheet",
                type: "IMAGE",
                name: "Sprite sheet",
                content: imgPlaceholder("Sprite sheet", "#F472B6", "#C026D3"),
              },
            ],
          },
          {
            id: "art-sprites-npc",
            name: "NPC faces",
            items: [
              { id: "npc-pack", type: "FILE", name: "faces.zip" },
              {
                id: "npc-mood",
                type: "IMAGE",
                name: "Mood reference",
                content: imgPlaceholder("Mood reference", "#FBBF24", "#EA580C"),
              },
            ],
          },
          {
            id: "art-sprites-masks",
            name: "Masks",
            items: [
              { id: "mask-code", type: "CODE", name: "mask-names.json" },
              { id: "mask-link", type: "LINK", name: "reference board" },
            ],
          },
        ],
      },
      {
        id: "art-brand",
        name: "Brand Kit",
        items: [
          {
            id: "art-brand-hero",
            type: "IMAGE",
            name: "Hero banner",
            content: imgPlaceholder("Hero banner", "#A78BFA", "#4F46E5"),
          },
        ],
        envelopes: [
          { id: "art-brand-logos", name: "Logos" },
          { id: "art-brand-palettes", name: "Palettes" },
        ],
      },
    ],
  },
  {
    key: "technical",
    label: "Technical",
    color: "#3B82F6",
    projects: [
      {
        id: "tech-system",
        name: "Design System",
        envelopes: [
          {
            id: "tech-system-buttons",
            name: "Buttons",
            items: [
              { id: "btn-docs", type: "NOTE", name: "Usage rules" },
              { id: "btn-tokens", type: "CODE", name: "buttons.css" },
            ],
          },
          { id: "tech-system-tokens", name: "Tokens" },
          {
            id: "tech-system-icons",
            name: "Icons",
            items: [
              {
                id: "icon-set",
                type: "IMAGE",
                name: "Icon set",
                content: imgPlaceholder("Icon set", "#38BDF8", "#2563EB"),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "management",
    label: "Management",
    color: "#F59E0B",
    projects: [
      {
        id: "mgmt-planning",
        name: "Q3 Planning",
        envelopes: [
          {
            id: "mgmt-planning-roadmap",
            name: "Roadmap",
            items: [{ id: "roadmap-doc", type: "FILE", name: "roadmap.pdf" }],
          },
        ],
      },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    color: "#FF4D6A",
    projects: [],
  },
];

export default function DrawersPage() {
  return (
    <div className="space-y-20 overflow-x-clip">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
            The Drawers
          </h1>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
            Visual demo
          </span>
        </div>
        <p className="max-w-2xl text-sm text-text-muted">
          One chest per section, one pull-out drawer per project, envelopes for
          sub-drawers. Pull one open, lift its contents, or add envelopes and
          loose files to try the interaction.
        </p>
      </header>

      <DrawersWorkshop sections={DEMO_SECTIONS} />
    </div>
  );
}
