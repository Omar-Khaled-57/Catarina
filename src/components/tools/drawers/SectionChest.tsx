"use client";

/**
 * SectionChest — the 3D cabinet for one section. Controlled by the workshop:
 * projects, open drawer, color and mutators live two levels up so the chest and
 * the focus-mode directory browser can drive each other.
 *
 * Language: a CHEST is one section; each pull-out DRAWER is a project; each
 * ENVELOPE is a sub-drawer; items are files.
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import { Plus, Trash2, Maximize2 } from "lucide-react";
import Envelope from "@/components/tools/drawers/Envelope";
import LooseFile from "@/components/tools/drawers/LooseFile";
import { useThemeSafeColor } from "@/components/tools/drawers/useThemeSafeColor";
import type { DemoProject, DemoSection } from "@/components/tools/drawers/types";

const CHEST_PAD = 10;
const CHEST_GAP = 8;
const CHEST_KICK = 30;
const MIN_DRAWER_HEIGHT = 76;

interface SectionChestProps {
  section: DemoSection;
  color: string;
  onColorChange: (color: string) => void;
  projects: DemoProject[];
  openId: string | null;
  onOpenProject: (id: string | null) => void;
  onAddProject: () => void;
  onRemoveProject: (id: string) => void;
  onAddEnvelope: (projectId: string) => void;
  onAddItem: (projectId: string) => void;
  onFocus: (() => void) | null;
  onFocusProject?: (projectId: string, envelopeId: string | null, fileId: string) => void;
}

export default function SectionChest({
  section,
  color,
  onColorChange,
  projects,
  openId,
  onOpenProject,
  onAddProject,
  onRemoveProject,
  onAddEnvelope,
  onAddItem,
  onFocus,
  onFocusProject,
}: SectionChestProps) {
  const openProject = (id: string) => {
    setRaisedId(null);
    onOpenProject(openId === id ? null : id);
  };

  const [raisedId, setRaisedId] = useState<string | null>(null);

  /* Faces/gradients use the theme-safe ink so white labels pass contrast in
     both themes; the swatch below keeps the raw chosen color. */
  const faceColor = useThemeSafeColor(color);

  const drawerCount = Math.max(1, projects.length);
  const drawerHeight = `calc((var(--chest-h) - ${CHEST_PAD}px - ${CHEST_KICK}px - ${
    (drawerCount - 1) * CHEST_GAP
  }px) / ${drawerCount})`;
  const chestHeight = Math.max(
    drawerCount === 1 ? 210 : 300,
    CHEST_PAD + CHEST_KICK + (drawerCount - 1) * CHEST_GAP + drawerCount * MIN_DRAWER_HEIGHT,
  );

  return (
    <div className="flex flex-col items-center gap-16">
      <div
        className="chest-scene"
        style={{ "--chest-color": faceColor } as CSSProperties}
      >
        <div className="chest-glow" aria-hidden="true" />
        <div
          className={`section-chest${drawerCount === 1 ? " section-chest--single-drawer" : ""}`}
          style={
            {
              "--chest-h": `${chestHeight}px`,
              "--drawer-h": drawerHeight,
            } as CSSProperties
          }
        >
          {["back", "left", "right", "top", "bottom"].map((face) => (
            <div
              key={face}
              className={`section-chest__panel section-chest__panel--${face}`}
            />
          ))}

          <div className="section-chest__panel section-chest__panel--front">
            <div className="section-chest__front-frame" aria-hidden="true" />
            {projects.slice(0, -1).map((project, i) => (
              <div
                key={project.id}
                className="section-chest__divider"
                aria-hidden="true"
                style={
                  {
                    "--i": i,
                    top: `calc(var(--chest-pad) + (var(--i) + 1) * (var(--drawer-h) + var(--chest-gap)) - var(--chest-gap))`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {projects.map((project, i) => {
            const isOpen = openId === project.id;
            return (
              <div
                key={project.id}
                className={`chest-drawer${isOpen ? " is-open" : ""}`}
                style={
                  {
                    "--i": i,
                    zIndex: isOpen ? 40 : Math.max(1, projects.length - i),
                  } as CSSProperties
                }
              >
                <div className="chest-drawer__structure">
                  {["left", "right", "bottom", "back"].map((panel) => (
                    <div
                      key={panel}
                      className={`chest-drawer__panel chest-drawer__panel--${panel}`}
                    >
                      {panel === "back" && (
                        <>
                          {project.envelopes.length === 0 && (
                            <span className="chest-drawer__empty">empty</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  <div
                    className="chest-drawer__contents"
                    role="group"
                    aria-label={`${project.name} contents`}
                    style={
                      {
                        "--drawer-content-count": Math.max(
                          1,
                          project.envelopes.length +
                            (project.items?.length ?? 0) -
                            1,
                        ),
                      } as CSSProperties
                    }
                  >
                    {project.envelopes.map((envelope, envelopeIndex) => (
                      <Envelope
                        key={`${envelope.id}-${isOpen ? "open" : "closed"}`}
                        envelope={envelope}
                        index={envelopeIndex}
                        raised={isOpen && raisedId === envelope.id}
                        onRaise={() => setRaisedId(envelope.id)}
                        onOpenInFocus={(fileId) =>
                          onFocusProject?.(project.id, envelope.id, fileId)
                        }
                      />
                    ))}
                    {(project.items ?? []).map((file, fileIndex) => (
                      <LooseFile
                        key={file.id}
                        file={file}
                        index={project.envelopes.length + fileIndex}
                        onOpenInFocus={() =>
                          onFocusProject?.(project.id, null, file.id)
                        }
                      />
                    ))}
                  </div>
                </div>

                {isOpen && !raisedId && (
                  <div className="chest-drawer__controls">
                    <button type="button" className="chest-drawer__add" onClick={() => onAddEnvelope(project.id)}>
                      <Plus size={10} /> Envelope
                    </button>
                    <button type="button" className="chest-drawer__add" onClick={() => onAddItem(project.id)}>
                      <Plus size={10} /> File
                    </button>
                    <button
                      type="button"
                      className="chest-drawer__remove"
                      onClick={() => onRemoveProject(project.id)}
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="chest-drawer__face"
                  aria-expanded={isOpen}
                  aria-label={`${project.name}${isOpen ? " — close" : " — open"}`}
                  onClick={() => openProject(project.id)}
                >
                  <span className="chest-drawer__handle" aria-hidden="true" />
                  <span className="chest-drawer__name">{project.name}</span>
                  <span className="chest-drawer__meta">
                    {project.envelopes.length}{" "}
                    {project.envelopes.length === 1 ? "envelope" : "envelopes"}
                  </span>
                </button>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="chest-empty">
              <span>No drawers yet</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <label
          className="relative inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/20 transition-transform hover:scale-110 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
          style={{ backgroundColor: color }}
          title={`Edit ${section.label} color`}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Edit ${section.label} color`}
          />
        </label>
        <span className="text-sm font-semibold text-text">{section.label}</span>
        <span className="text-xs text-text-muted">
          {projects.length} {projects.length === 1 ? "drawer" : "drawers"}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onAddProject}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={13} />
            Add drawer
          </button>
          {onFocus && (
            <button
              type="button"
              onClick={onFocus}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Maximize2 size={13} />
              Focus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
