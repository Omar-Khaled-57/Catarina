"use client";

/**
 * DrawersWorkshop — owns the demo data and all shared state. Two views:
 *   1. Grid — every section as its own 3D chest.
 *   2. Focus mode — one section's chest slides to the left, vertically
 *      centered; the directory browser opens on the right. They stay linked:
 *      opening a drawer opens that project's directory, and clicking a
 *      directory opens its drawer.
 *
 * 3D safety: the chest's ancestors that animate never fade (opacity would
 * flatten the preserve-3d scene) — instead they carry `transform-style:
 * preserve-3d`, and only the replicated wrapper's transform (translate/scale)
 * animates. The backdrop fades separately as a sibling.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import SectionChest from "@/components/tools/drawers/SectionChest";
import DirectoryBrowser from "@/components/tools/drawers/DirectoryBrowser";
import type {
  DemoSection,
  DemoProject,
  DirItem,
} from "@/components/tools/drawers/types";

const playSpring = { type: "spring", stiffness: 210, damping: 22, mass: 0.9 } as const;
const exitTween = { duration: 0.32, ease: [0.32, 0.72, 0, 1] } as const;

let demoIdSeq = 0;

type FocusTarget = { envelopeId: string; fileId: string } | null;

export default function DrawersWorkshop({
  sections: initialSections,
}: {
  sections: DemoSection[];
}) {
  const [sections, setSections] = useState<DemoSection[]>(initialSections);
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialSections.map((s) => [s.key, s.color])),
  );
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, string | null>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const reduce = useReducedMotion();

  const transition = reduce ? { duration: 0.01 } : playSpring;
  const exitTransition = reduce ? { duration: 0.01 } : exitTween;

  const focused = useMemo(
    () => sections.find((s) => s.key === focusedKey) ?? null,
    [sections, focusedKey],
  );
  const focusedOpenId = focused ? (openIds[focused.key] ?? null) : null;
  const activeProject: DemoProject | null =
    (focused?.projects.find((p) => p.id === focusedOpenId) as DemoProject | null) ??
    null;

  const addProject = (sectionKey: string) => {
    const id = `demo-${sectionKey}-${++demoIdSeq}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: [
                ...s.projects,
                {
                  id,
                  name: `Drawer ${s.projects.length + 1}`,
                  envelopes: [],
                },
              ],
            }
          : s,
      ),
    );
  };

  const renameProject = (sectionKey: string, id: string, name: string) => {
    const trimmed = name.trim();
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === id ? { ...p, name: trimmed || p.name } : p,
              ),
            }
          : s,
      ),
    );
  };

  const addEnvelope = (sectionKey: string, projectId: string) => {
    const id = `demo-envelope-${++demoIdSeq}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      envelopes: [
                        ...p.envelopes,
                        {
                          id,
                          name: `Envelope ${p.envelopes.length + 1}`,
                          items: [],
                        },
                      ],
                    }
                  : p,
              ),
            }
          : s,
      ),
    );
  };

  const addItem = (sectionKey: string, projectId: string) => {
    const id = `demo-item-${++demoIdSeq}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      items: [
                        ...(p.items ?? []),
                        {
                          id,
                          type: "FILE",
                          name: `file ${(p.items ?? []).length + 1}`,
                        },
                      ],
                    }
                  : p,
              ),
            }
          : s,
      ),
    );
  };

  const createFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    item: Omit<DirItem, "id">,
  ) => {
    const id = `demo-file-${++demoIdSeq}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) => {
                if (p.id !== projectId) return p;
                if (envelopeId) {
                  return {
                    ...p,
                    envelopes: p.envelopes.map((e) =>
                      e.id === envelopeId
                        ? {
                            ...e,
                            items: [...(e.items ?? []), { id, ...item }],
                          }
                        : e,
                    ),
                  };
                }
                return { ...p, items: [...(p.items ?? []), { id, ...item }] };
              }),
            }
          : s,
      ),
    );
  };

  const renameEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
    name: string,
  ) => {
    const trimmed = name.trim();
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      envelopes: p.envelopes.map((e) =>
                        e.id === envelopeId
                          ? { ...e, name: trimmed || e.name }
                          : e,
                      ),
                    }
                  : p,
              ),
            }
          : s,
      ),
    );
  };

  const renameItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    name: string,
  ) => {
    const trimmed = name.trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            if (envelopeId) {
              return {
                ...p,
                envelopes: p.envelopes.map((e) =>
                  e.id === envelopeId
                    ? {
                        ...e,
                        items: (e.items ?? []).map((it) =>
                          it.id === itemId
                            ? { ...it, name: trimmed || it.name }
                            : it,
                        ),
                      }
                    : e,
                ),
              };
            }
            return {
              ...p,
              items: (p.items ?? []).map((it) =>
                it.id === itemId ? { ...it, name: trimmed || it.name } : it,
              ),
            };
          }),
        };
      }),
    );
  };

  const updateFileContent = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    content: string,
  ) => {
    const cleaned = content.trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const patch = (it: DirItem): DirItem =>
              it.id === itemId
                ? { ...it, ...(cleaned ? { content: cleaned } : { content: undefined }) }
                : it;
            if (envelopeId) {
              return {
                ...p,
                envelopes: p.envelopes.map((e) =>
                  e.id === envelopeId
                    ? { ...e, items: (e.items ?? []).map(patch) }
                    : e,
                ),
              };
            }
            return { ...p, items: (p.items ?? []).map(patch) };
          }),
        };
      }),
    );
  };

  const removeFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
  ) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            if (envelopeId) {
              return {
                ...p,
                envelopes: p.envelopes.map((e) =>
                  e.id === envelopeId
                    ? {
                        ...e,
                        items: (e.items ?? []).filter((it) => it.id !== itemId),
                      }
                    : e,
                ),
              };
            }
            return {
              ...p,
              items: (p.items ?? []).filter((it) => it.id !== itemId),
            };
          }),
        };
      }),
    );
  };

  const groupItems = (
    sectionKey: string,
    projectId: string,
    itemIds: string[],
  ) => {
    const id = `demo-envelope-${++demoIdSeq}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      envelopes: [
                        ...p.envelopes,
                        {
                          id,
                          name: `Envelope ${p.envelopes.length + 1}`,
                          items: (p.items ?? []).filter((it) =>
                            itemIds.includes(it.id),
                          ),
                        },
                      ],
                      items: (p.items ?? []).filter(
                        (it) => !itemIds.includes(it.id),
                      ),
                    }
                  : p,
              ),
            }
          : s,
      ),
    );
  };

  const removeProject = (sectionKey: string, id: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? { ...s, projects: s.projects.filter((p) => p.id !== id) }
          : s,
      ),
    );
    setOpenIds((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey] === id ? null : (prev[sectionKey] ?? null),
    }));
  };

  const toggleOpen = (sectionKey: string, id: string | null) => {
    setOpenIds((prev) => {
      if (id === null) return { ...prev, [sectionKey]: null };
      const current = prev[sectionKey] ?? null;
      return { ...prev, [sectionKey]: current === id ? null : id };
    });
  };
  const setColor = (key: string, color: string) =>
    setColors((prev) => ({ ...prev, [key]: color }));

  const enterFocus = (key: string) => {
    setFocusTarget(null);
    setFocusedKey(key);
  };

  const focusProject = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
    fileId: string,
  ) => {
    setOpenIds((prev) => ({ ...prev, [sectionKey]: projectId }));
    setFocusTarget({ envelopeId, fileId });
    setFocusedKey(sectionKey);
  };

  const exitFocus = () => {
    setFocusedKey(null);
  };

  useEffect(() => {
    if (!focusedKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exitFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedKey]);

  return (
    <>
      <div className="grid justify-items-center gap-14 lg:grid-cols-2">
        {sections.map((section) => {
          const hiddenInGrid = focusedKey === section.key;
          return (
            <div
              key={section.key}
              className={hiddenInGrid ? "invisible" : undefined}
              aria-hidden={hiddenInGrid || undefined}
            >
              <SectionChest
                section={section}
                color={colors[section.key] ?? section.color}
                onColorChange={(c) => setColor(section.key, c)}
                projects={section.projects}
                openId={openIds[section.key] ?? null}
                onOpenProject={(id) => toggleOpen(section.key, id)}
                onAddProject={() => addProject(section.key)}
                onRemoveProject={(id) => removeProject(section.key, id)}
                onAddEnvelope={(pid) => addEnvelope(section.key, pid)}
                onAddItem={(pid) => addItem(section.key, pid)}
                onFocus={() => enterFocus(section.key)}
                onFocusProject={(pid, envId, fileId) =>
                  focusProject(section.key, pid, envId, fileId)
                }
              />
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {focused && (
          <motion.div
            key="focus-overlay"
            className="fixed inset-0 z-50 overflow-y-auto"
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{
              hidden: { opacity: 0, transition: exitTransition },
              show: { opacity: 1, transition: { duration: 0.25 } },
            }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={exitFocus}
              variants={{
                hidden: { opacity: 0, transition: exitTransition },
                show: { opacity: 1, transition: { duration: 0.25 } },
              }}
            />

            <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-12 md:min-h-full md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 md:px-6 md:py-24">
              <motion.div
                className="flex items-center justify-center"
                style={{ transformStyle: "preserve-3d" }}
                variants={{
                  hidden: {
                    x: -80,
                    scale: 0.94,
                    opacity: 0,
                    transition: exitTransition,
                  },
                  show: {
                    x: 0,
                    scale: reduce ? 1 : 1.12,
                    opacity: 1,
                    transition,
                  },
                }}
              >
                <SectionChest
                  section={focused}
                  color={colors[focused.key] ?? focused.color}
                  onColorChange={(c) => setColor(focused.key, c)}
                  projects={focused.projects}
                  openId={focusedOpenId}
                  onOpenProject={(id) => toggleOpen(focused.key, id)}
                  onAddProject={() => addProject(focused.key)}
                  onRemoveProject={(id) => removeProject(focused.key, id)}
                  onAddEnvelope={(pid) => addEnvelope(focused.key, pid)}
                  onAddItem={(pid) => addItem(focused.key, pid)}
                  onFocus={null}
                />
              </motion.div>

              <motion.div
                className="flex justify-center md:justify-start"
                variants={{
                  hidden: { x: 120, opacity: 0, transition: exitTransition },
                  show: { x: 0, opacity: 1, transition },
                }}
              >
                <div className="w-full max-w-lg">
                  <DirectoryBrowser
                    section={focused}
                    color={colors[focused.key] ?? focused.color}
                    activeProject={activeProject}
                    focusTarget={focusTarget}
                    onOpenProject={(id) => toggleOpen(focused.key, id)}
                    onAddProject={() => addProject(focused.key)}
                    onAddEnvelope={(pid) => addEnvelope(focused.key, pid)}
                    onCreateFile={(pid, envId, item) =>
                      createFile(focused.key, pid, envId, item)
                    }
                    onRenameProject={(id, name) =>
                      renameProject(focused.key, id, name)
                    }
                    onRenameEnvelope={(pid, envId, name) =>
                      renameEnvelope(focused.key, pid, envId, name)
                    }
                    onRenameItem={(pid, envId, itemId, name) =>
                      renameItem(focused.key, pid, envId, itemId, name)
                    }
                    onUpdateFileContent={(pid, envId, itemId, content) =>
                      updateFileContent(focused.key, pid, envId, itemId, content)
                    }
                    onRemoveItem={(pid, envId, itemId) =>
                      removeFile(focused.key, pid, envId, itemId)
                    }
                    onDeleteProject={(id) => removeProject(focused.key, id)}
                    onGroupItems={(pid, itemIds) =>
                      groupItems(focused.key, pid, itemIds)
                    }
                    onClose={exitFocus}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
