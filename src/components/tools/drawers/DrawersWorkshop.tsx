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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, File, Loader2, Pause, Play, X } from "lucide-react";
import SectionChest from "@/components/tools/drawers/SectionChest";
import DirectoryBrowser from "@/components/tools/drawers/DirectoryBrowser";
import { useFocusTrap } from "@/components/tools/drawers/useFocusTrap";
import type {
  DemoSection,
  DemoProject,
  DirItem,
} from "@/components/tools/drawers/types";

const playSpring = { type: "spring", stiffness: 210, damping: 22, mass: 0.9 } as const;
const exitTween = { duration: 0.32, ease: [0.32, 0.72, 0, 1] } as const;

let demoIdSeq = 0;

type FocusTarget = { envelopeId: string | null; fileId: string } | null;

type CloudState = {
  /** Workspace fetched from the server — the drawers are the team cloud. */
  ready: boolean;
  /** The initial workspace request has not settled yet. */
  loading: boolean;
  syncing: boolean;
  /** The latest write failure stays visible until the next sync attempt. */
  error: string | null;
};

type UploadStatus = "running" | "paused" | "failed";

/** A large (chunked) upload tracked by the UI so it can show progress and be
 *  paused, resumed or cancelled mid-flight. */
type UploadTask = {
  id: string; // server uploadId
  name: string;
  type: string;
  size: number;
  chunkSize: number;
  chunkCount: number;
  uploaded: number; // parts persisted server-side so far
  status: UploadStatus;
  error: string | null;
  file: File; // kept so a resumed upload can slice the remaining parts
  sectionKey: string;
  projectId: string;
  envelopeId: string | null;
};

type CreateItem = Omit<DirItem, "id"> & { file?: File };

/* Vercel caps function request bodies at ~4.5MB, so a single base64 file can
   only be ~3MB raw. Bigger files are split into 3MB parts; each part rides in
   its own mutation and is assembled server-side (see src/lib/workspaceFiles). */
const INLINE_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILE_BYTES = 300 * 1024 * 1024;

function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export default function DrawersWorkshop({
  sections: initialSections,
}: {
  sections: DemoSection[];
}) {
  const [sections, setSections] = useState<DemoSection[]>(initialSections);
  /* Live snapshot for optimistic updates: a queued mutation needs the tree as
     of the moment it reaches the head of the queue, so it can roll back to
     exactly the pre-action state if the request fails. */
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialSections.map((s) => [s.key, s.color])),
  );
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, string | null>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const reduce = useReducedMotion();
  const focusOverlayRef = useRef<HTMLDivElement | null>(null);
  const focusTriggerRef = useRef<HTMLElement | null>(null);

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
    envelopeId: string | null,
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

  const removeEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              projects: s.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      envelopes: p.envelopes.filter((e) => e.id !== envelopeId),
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

  /* ---- Team cloud layer --------------------------------------------------
     Signed-in users share one team workspace backed by the Turso DB; every
     mutation goes through /api/drawers/mutate and returns the refreshed
     section. Guests keep the in-memory demo seeded from the page. */

  const [cloud, setCloud] = useState<CloudState>({
    ready: false,
    loading: true,
    syncing: false,
    error: null,
  });
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  const cloudMode = cloud.ready;

  const notify = (message: string | null) => {
    setNotifyMessage(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    if (message) {
      noticeTimer.current = window.setTimeout(() => setNotifyMessage(null), 5000);
    }
  };

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const api = async (path: string, init?: RequestInit): Promise<Response> => {
    const isForm = init?.body instanceof FormData;
    const res = await fetch(path, {
      ...init,
      headers: isForm
        ? undefined
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `Request failed (${res.status})`);
    }
    return res;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/drawers/workspace");
        if (!res.ok) {
          if (!cancelled) {
            // Guest → keep the seeded local demo without leaving a stale
            // connecting indicator in the header.
            setCloud({ ready: false, loading: false, syncing: false, error: null });
          }
          return;
        }
        const data = (await res.json()) as { sections: DemoSection[] };
        if (cancelled) return;
        setSections((prev) => {
          const order = prev.map((s) => s.key.toUpperCase());
          return [...data.sections].sort((a, b) => {
            const ia = order.indexOf(a.key.toUpperCase());
            const ib = order.indexOf(b.key.toUpperCase());
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          });
        });
        setCloud({ ready: true, loading: false, syncing: false, error: null });
      } catch {
        if (!cancelled) {
          setCloud({ ready: false, loading: false, syncing: false, error: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Mutations are serialized through a promise chain: the server applies each
     drawer action as a read-modify-write of the section tree, so two requests
     in flight can overwrite each other's changes. Queueing them keeps the last
     click winning. Tree writes from upload completion go through the same chain. */
  const mutateTailRef = useRef<Promise<void>>(Promise.resolve());
  const syncingCountRef = useRef(0);

  const setSyncing = (delta: 1 | -1) => {
    syncingCountRef.current = Math.max(0, syncingCountRef.current + delta);
    const syncing = syncingCountRef.current > 0;
    setCloud((c) =>
      c.ready ? { ...c, syncing, ...(syncing ? { error: null } : {}) } : c,
    );
  };

  const markCloudFailure = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    setCloud((c) => (c.ready ? { ...c, error: message } : c));
    notify(message);
  };

  /** Queue a tree-writing request behind any in-flight mutation. Rejects if
   *  the request fails, so callers that must know the outcome (e.g. upload
   *  completion) can react. */
  const enqueueMutation = (run: () => Promise<void>): Promise<void> => {
    const task = mutateTailRef.current.then(async () => {
      setSyncing(1);
      try {
        await run();
      } finally {
        setSyncing(-1);
      }
    });
    /* A failed mutation must not stall the chain. */
    mutateTailRef.current = task.catch(() => undefined);
    return task;
  };

  const applySection = (section: DemoSection) =>
    setSections((prev) =>
      prev.map((s) => (s.key === section.key ? section : s)),
    );

  const runCloud = (
    label: string,
    sectionKey: string,
    payload: Record<string, unknown>,
    optimistic?: { apply: () => void; rollback: () => void },
  ) =>
    enqueueMutation(async () => {
      /* Optimistic UI: mutate the visible tree the moment this mutation
         reaches the head of the queue, then let the server's authoritative
         section reconcile it. Reverts on failure so a dead request can't
         leave a phantom drawer. */
      optimistic?.apply();
      try {
        const res = await api("/api/drawers/mutate", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const { section } = (await res.json()) as { section: DemoSection };
        applySection(section);
      } catch (error) {
        optimistic?.rollback();
        markCloudFailure(error, `Failed to ${label}.`);
      }
    });

  /** Optimistic wrapper: snapshot the tree now, apply a local change instantly
   *  (same transform the guest/demo path uses), and restore the snapshot if the
   *  queued request fails — so every drawer action feels instant and a dead
   *  request can never leave a phantom change behind. */
  const optimistic = (mutate: () => void) => {
    let snapshot: DemoSection[] | null = null;
    return {
      apply: () => {
        snapshot = sectionsRef.current;
        mutate();
      },
      rollback: () => {
        if (snapshot) setSections(snapshot);
      },
    };
  };

  const sectionCount = (sectionKey: string) =>
    sections.find((s) => s.key === sectionKey)?.projects.length ?? 0;
  const projectCount = (sectionKey: string, projectId: string) =>
    sections
      .find((s) => s.key === sectionKey)
      ?.projects.find((p) => p.id === projectId);
  const looseFileCount = (sectionKey: string, projectId: string) =>
    projectCount(sectionKey, projectId)?.items?.length ?? 0;
  const envelopeCount = (sectionKey: string, projectId: string) =>
    projectCount(sectionKey, projectId)?.envelopes.length ?? 0;

  const cloudAddProject = (sectionKey: string) =>
    runCloud(
      "create drawer",
      sectionKey,
      {
        action: "createProject",
        sectionKey,
        name: `Drawer ${sectionCount(sectionKey) + 1}`,
      },
      optimistic(() => addProject(sectionKey)),
    );

  const cloudRenameProject = (sectionKey: string, id: string, name: string) =>
    runCloud(
      "rename",
      sectionKey,
      { action: "renameProject", sectionKey, projectId: id, name },
      optimistic(() => renameProject(sectionKey, id, name)),
    );

  const cloudDeleteProject = (sectionKey: string, id: string) =>
    runCloud(
      "delete",
      sectionKey,
      { action: "deleteProject", sectionKey, projectId: id },
      optimistic(() => removeProject(sectionKey, id)),
    );

  const cloudAddEnvelope = (sectionKey: string, projectId: string) =>
    runCloud(
      "create envelope",
      sectionKey,
      {
        action: "addEnvelope",
        sectionKey,
        projectId,
        name: `Envelope ${envelopeCount(sectionKey, projectId) + 1}`,
      },
      optimistic(() => addEnvelope(sectionKey, projectId)),
    );

  const cloudQuickAddItem = (sectionKey: string, projectId: string) =>
    runCloud(
      "create file",
      sectionKey,
      {
        action: "createItem",
        sectionKey,
        projectId,
        envelopeId: null,
        item: {
          name: `file ${looseFileCount(sectionKey, projectId) + 1}`,
          type: "FILE",
        },
      },
      optimistic(() => addItem(sectionKey, projectId)),
    );

  const cloudCreateFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    item: CreateItem,
  ) => {
    if (item.file) {
      const file = item.file;
      if (file.size > MAX_FILE_BYTES) {
        notify(
          `That file is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`,
        );
        return;
      }
      if (file.size <= INLINE_FILE_BYTES) {
        void (async () => {
          try {
            const content = await fileToDataUri(file);
            runCloud(
              "create file",
              sectionKey,
              {
                action: "createItem",
                sectionKey,
                projectId,
                envelopeId,
                item: { name: item.name, type: item.type, content },
              },
              optimistic(() =>
                createFile(sectionKey, projectId, envelopeId, {
                  name: item.name,
                  type: item.type,
                  content,
                }),
              ),
            );
          } catch (error) {
            notify(error instanceof Error ? error.message : "Failed to read the file.");
          }
        })();
        return;
      }
      void startBigUpload(sectionKey, projectId, envelopeId, file, item);
      return;
    }
    runCloud(
      "create file",
      sectionKey,
      {
        action: "createItem",
        sectionKey,
        projectId,
        envelopeId,
        item: {
          name: item.name,
          type: item.type,
          ...(item.content ? { content: item.content } : {}),
        },
      },
      optimistic(() =>
        createFile(sectionKey, projectId, envelopeId, {
          name: item.name,
          type: item.type,
          ...(item.content ? { content: item.content } : {}),
        }),
      ),
    );
  };

  /* ---- Big-file uploads: progress, pause/resume, cancel -------------------
     Files over 3MB are split into 3MB parts; each part rides in its own
     mutation request (under Vercel's ~4.5MB body cap) and is stored server-side
     on arrival, so a paused upload resumes from the exact part it stopped at
     and a cancelled one is aborted server-side (parts + session dropped). */

  const [uploads, setUploads] = useState<Record<string, UploadTask>>({});
  const uploadsRef = useRef<Record<string, UploadTask>>({});
  /* Per-upload control flags (paused/cancelled/pumping) live in a ref so the
     pump loop can read the latest decision without stale closures. */
  const uploadFlags = useRef<
    Map<string, { paused: boolean; cancelled: boolean; pumping: boolean }>
  >(new Map());

  const addUpload = (task: UploadTask) => {
    uploadsRef.current = { ...uploadsRef.current, [task.id]: task };
    setUploads((prev) => (prev[task.id] ? prev : { ...prev, [task.id]: task }));
  };

  const patchUpload = (uploadId: string, patch: Partial<UploadTask>) => {
    const current = uploadsRef.current[uploadId];
    if (!current) return;
    uploadsRef.current[uploadId] = { ...current, ...patch };
    setUploads((prev) =>
      prev[uploadId] ? { ...prev, [uploadId]: { ...prev[uploadId], ...patch } } : prev,
    );
  };

  const dropUpload = (uploadId: string) => {
    const next = { ...uploadsRef.current };
    delete next[uploadId];
    uploadsRef.current = next;
    setUploads((prev) => {
      const nextState = { ...prev };
      delete nextState[uploadId];
      return nextState;
    });
  };

  const startBigUpload = async (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    file: File,
    item: CreateItem,
  ) => {
    try {
      const startRes = await api("/api/drawers/mutate", {
        method: "POST",
        body: JSON.stringify({
          action: "uploadStart",
          sectionKey,
          projectId,
          envelopeId,
          item: {
            name: item.name,
            type: item.type,
            mime: file.type || "application/octet-stream",
            size: file.size,
          },
        }),
      });
      const { uploadId, chunkSize, chunkCount } = (await startRes.json()) as {
        uploadId: string;
        chunkSize: number;
        chunkCount: number;
      };
      uploadFlags.current.set(uploadId, {
        paused: false,
        cancelled: false,
        pumping: false,
      });
      addUpload({
        id: uploadId,
        name: file.name,
        type: item.type,
        size: file.size,
        chunkSize,
        chunkCount,
        uploaded: 0,
        status: "running",
        error: null,
        file,
        sectionKey,
        projectId,
        envelopeId,
      });
      void pumpUpload(uploadId);
    } catch (error) {
      markCloudFailure(error, "Failed to start the upload.");
    }
  };

  const pumpUpload = async (uploadId: string) => {
    const flags = uploadFlags.current.get(uploadId);
    if (!flags || flags.pumping) return;
    flags.pumping = true;
    try {
      while (true) {
        const task = uploadsRef.current[uploadId];
        if (!task || flags.cancelled) return;
        if (task.uploaded >= task.chunkCount) break;
        if (flags.paused) break;

        const i = task.uploaded;
        const start = i * task.chunkSize;
        const end = Math.min(start + task.chunkSize, task.size);
        try {
          const uri = await fileToDataUri(task.file.slice(start, end));
          await api("/api/drawers/mutate", {
            method: "POST",
            body: JSON.stringify({
              action: "uploadChunk",
              sectionKey: task.sectionKey,
              uploadId,
              index: i,
              data: uri.slice(uri.indexOf(",") + 1),
            }),
          });
        } catch (error) {
          if (flags.cancelled || flags.paused) return;
          markCloudFailure(error, "Upload interrupted.");
          patchUpload(uploadId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload interrupted.",
          });
          return;
        }
        patchUpload(uploadId, { uploaded: i + 1 });
      }

      const task = uploadsRef.current[uploadId];
      if (!task || flags.cancelled) return;
      if (flags.paused || task.uploaded < task.chunkCount) {
        patchUpload(uploadId, { status: "paused" });
        return;
      }

      /* Every part is stored — ask the server to assemble and register. It
         rides the same mutation queue so the tree write can't race another
         drawer action (both are read-modify-writes of the section). */
      try {
        await enqueueMutation(async () => {
          const doneRes = await api("/api/drawers/mutate", {
            method: "POST",
            body: JSON.stringify({
              action: "uploadComplete",
              sectionKey: task.sectionKey,
              uploadId,
            }),
          });
          const { section } = (await doneRes.json()) as { section: DemoSection };
          applySection(section);
        });
        notify(`${task.name} is in the drawer.`);
        window.setTimeout(() => dropUpload(uploadId), 1800);
      } catch (error) {
        markCloudFailure(error, "Could not finish the upload.");
        patchUpload(uploadId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Could not finish the upload.",
        });
      }
    } finally {
      const flags = uploadFlags.current.get(uploadId);
      if (flags) flags.pumping = false;
    }
  };

  const togglePauseUpload = (uploadId: string) => {
    const flags = uploadFlags.current.get(uploadId);
    const task = uploadsRef.current[uploadId];
    if (!flags || !task || task.status === "failed") return;
    if (flags.paused) {
      flags.paused = false;
      patchUpload(uploadId, { status: "running" });
      void pumpUpload(uploadId);
    } else {
      flags.paused = true;
      patchUpload(uploadId, { status: "paused" });
    }
  };

  const cancelUpload = async (uploadId: string) => {
    const flags = uploadFlags.current.get(uploadId);
    if (flags) flags.cancelled = true;
    const task = uploadsRef.current[uploadId];
    if (task?.status !== "failed") {
      try {
        await api("/api/drawers/mutate", {
          method: "POST",
          body: JSON.stringify({
            action: "uploadAbort",
            sectionKey: task?.sectionKey ?? "",
            uploadId,
          }),
        });
      } catch {
        /* Session already gone / never owned — nothing to clean up. */
      }
    }
    uploadFlags.current.delete(uploadId);
    dropUpload(uploadId);
  };

  const formatMb = (bytes: number) =>
    `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const cloudRenameEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
    name: string,
  ) =>
    runCloud(
      "rename",
      sectionKey,
      { action: "renameEnvelope", sectionKey, projectId, envelopeId, name },
      optimistic(() => renameEnvelope(sectionKey, projectId, envelopeId, name)),
    );

  const cloudDeleteEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
  ) =>
    runCloud(
      "delete envelope",
      sectionKey,
      { action: "deleteEnvelope", sectionKey, projectId, envelopeId },
      optimistic(() => removeEnvelope(sectionKey, projectId, envelopeId)),
    );

  const cloudRenameItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    name: string,
  ) =>
    runCloud(
      "rename",
      sectionKey,
      { action: "renameItem", sectionKey, projectId, envelopeId, itemId, name },
      optimistic(() => renameItem(sectionKey, projectId, envelopeId, itemId, name)),
    );

  const cloudUpdateFileContent = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    content: string,
  ) =>
    runCloud(
      "save content",
      sectionKey,
      {
        action: "updateItemContent",
        sectionKey,
        projectId,
        envelopeId,
        itemId,
        content,
      },
      optimistic(() =>
        updateFileContent(sectionKey, projectId, envelopeId, itemId, content),
      ),
    );

  const cloudRemoveItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
  ) =>
    runCloud(
      "delete",
      sectionKey,
      { action: "removeItem", sectionKey, projectId, envelopeId, itemId },
      optimistic(() => removeFile(sectionKey, projectId, envelopeId, itemId)),
    );

  const cloudGroupItems = (
    sectionKey: string,
    projectId: string,
    itemIds: string[],
  ) =>
    runCloud(
      "group files",
      sectionKey,
      {
        action: "groupItems",
        sectionKey,
        projectId,
        itemIds,
        name: `Envelope ${envelopeCount(sectionKey, projectId) + 1}`,
      },
      optimistic(() => groupItems(sectionKey, projectId, itemIds)),
    );

  /* Handlers choose between the cloud workspace and the local demo. */
  const handleAddProject = (sectionKey: string) => {
    if (cloudMode) return cloudAddProject(sectionKey);
    addProject(sectionKey);
  };
  const handleRemoveProject = (sectionKey: string, id: string) => {
    if (cloudMode) return cloudDeleteProject(sectionKey, id);
    removeProject(sectionKey, id);
  };
  const handleAddEnvelope = (sectionKey: string, projectId: string) => {
    if (cloudMode) return cloudAddEnvelope(sectionKey, projectId);
    addEnvelope(sectionKey, projectId);
  };
  const handleAddItem = (sectionKey: string, projectId: string) => {
    if (cloudMode) return cloudQuickAddItem(sectionKey, projectId);
    addItem(sectionKey, projectId);
  };
  const handleRenameProject = (sectionKey: string, id: string, name: string) => {
    if (cloudMode) return cloudRenameProject(sectionKey, id, name);
    renameProject(sectionKey, id, name);
  };
  const handleRenameEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    name: string,
  ) => {
    if (cloudMode) {
      if (envelopeId) cloudRenameEnvelope(sectionKey, projectId, envelopeId, name);
      return;
    }
    if (envelopeId) renameEnvelope(sectionKey, projectId, envelopeId, name);
  };
  const handleDeleteEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string,
  ) => {
    if (cloudMode) return cloudDeleteEnvelope(sectionKey, projectId, envelopeId);
    removeEnvelope(sectionKey, projectId, envelopeId);
  };
  const handleCreateFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    item: CreateItem,
  ) => {
    if (cloudMode) return cloudCreateFile(sectionKey, projectId, envelopeId, item);
    createFile(sectionKey, projectId, envelopeId, item);
  };
  const handleRenameItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    name: string,
  ) => {
    if (cloudMode) return cloudRenameItem(sectionKey, projectId, envelopeId, itemId, name);
    renameItem(sectionKey, projectId, envelopeId, itemId, name);
  };
  const handleUpdateFileContent = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    content: string,
  ) => {
    if (cloudMode) return cloudUpdateFileContent(sectionKey, projectId, envelopeId, itemId, content);
    updateFileContent(sectionKey, projectId, envelopeId, itemId, content);
  };
  const handleRemoveItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
  ) => {
    if (cloudMode) return cloudRemoveItem(sectionKey, projectId, envelopeId, itemId);
    removeFile(sectionKey, projectId, envelopeId, itemId);
  };
  const handleGroupItems = (sectionKey: string, projectId: string, itemIds: string[]) => {
    if (cloudMode) return cloudGroupItems(sectionKey, projectId, itemIds);
    groupItems(sectionKey, projectId, itemIds);
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
    focusTriggerRef.current = (document.activeElement as HTMLElement) ?? null;
  };

  const focusProject = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    fileId: string,
  ) => {
    setOpenIds((prev) => ({ ...prev, [sectionKey]: projectId }));
    setFocusTarget({ envelopeId, fileId });
    setFocusedKey(sectionKey);
  };

  const exitFocus = () => {
    setFocusedKey(null);
  };

  /* Modal convention: the focus-mode dialog takes focus when it opens. Focus is
     returned to the trigger once the overlay's exit animation completes. */
  useEffect(() => {
    if (!focusedKey) return;
    const dialog = focusOverlayRef.current?.querySelector<HTMLElement>(
      '[role="dialog"]',
    );
    dialog?.focus();
  }, [focusedKey]);

  const runningUpload = Object.values(uploads).find(
    (task) => task.status === "running",
  );
  const pausedUpload = Object.values(uploads).find(
    (task) => task.status === "paused",
  );
  const failedUpload = Object.values(uploads).find(
    (task) => task.status === "failed",
  );
  const syncFailure = cloud.error ?? failedUpload?.error ?? null;
  const isSyncing = cloud.syncing || !!runningUpload;
  useFocusTrap(focusOverlayRef, focusedKey !== null);

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
      {(cloudMode || cloud.loading) && typeof document !== "undefined" &&
        ["landscape", "portrait"].map((orientation) => {
          const target = document.getElementById(
            `drawers-cloud-status-${orientation}`,
          );
          if (!target) return null;
          return createPortal(
            <div className="drawers-cloud-status inline-flex flex-wrap items-center gap-3 text-sm">
              {cloud.loading ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="size-3.5 animate-spin" />
                  Connecting to the team cloud
                </span>
              ) : isSyncing ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="size-3.5 animate-spin" />
                  Syncing to the team cloud
                </span>
              ) : syncFailure ? (
                <span
                  title={syncFailure}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/25 bg-slate-400/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  <X className="size-3.5" />
                  Failed to sync
                </span>
              ) : pausedUpload ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Pause className="size-3.5" />
                  Upload paused
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <Check className="size-3.5" />
                  Synced to the team cloud
                </span>
              )}
              {notifyMessage && !syncFailure && !isSyncing && (
                <span className="inline-flex items-center rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-muted">
                  {notifyMessage}
                </span>
              )}
            </div>,
            target,
            orientation,
          );
        })}

      <div className="grid items-end justify-items-center gap-20 lg:grid-cols-2" inert={!!focusedKey || undefined}>
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
                onAddProject={() => handleAddProject(section.key)}
                onRemoveProject={(id) => handleRemoveProject(section.key, id)}
                onAddEnvelope={(pid) => handleAddEnvelope(section.key, pid)}
                onAddItem={(pid) => handleAddItem(section.key, pid)}
                onFocus={() => enterFocus(section.key)}
                onFocusProject={(pid, envId, fileId) =>
                  focusProject(section.key, pid, envId, fileId)
                }
              />
            </div>
          );
        })}
      </div>

      <AnimatePresence onExitComplete={() => {
          focusTriggerRef.current?.focus?.();
          focusTriggerRef.current = null;
        }}>
        {focused && (
          <motion.div
            key="focus-overlay"
            ref={focusOverlayRef}
            className="focus-overlay fixed inset-0 z-50 min-h-dvh overflow-x-hidden overflow-y-auto overscroll-contain"
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{
              hidden: { opacity: 0, transition: exitTransition },
              show: { opacity: 1, transition: { duration: 0.25 } },
            }}
          >
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
              onClick={exitFocus}
              variants={{
                hidden: { opacity: 0, transition: exitTransition },
                show: { opacity: 1, transition: { duration: 0.25 } },
              }}
            />

            <div className="focus-shell relative z-10 flex min-h-dvh w-full items-start justify-center">
              <div className="focus-layout grid w-full items-start justify-items-center">
                <motion.div
                  className="focus-chest-stage mx-auto flex items-center justify-center"
                  style={{ transformStyle: "preserve-3d" }}
                  variants={{
                    hidden: {
                      scale: 0.94,
                      opacity: 0,
                      transition: exitTransition,
                    },
                    show: {
                      /* The 3D chest already extends beyond its layout box.
                         Avoid scaling it further, which could collide with the
                         directory panel at narrow tablet widths. */
                      scale: 1,
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
                  onAddProject={() => handleAddProject(focused.key)}
                  onRemoveProject={(id) => handleRemoveProject(focused.key, id)}
                  onAddEnvelope={(pid) => handleAddEnvelope(focused.key, pid)}
                  onAddItem={(pid) => handleAddItem(focused.key, pid)}
                  onFocus={null}
                />
              </motion.div>

                <motion.div
                  className="flex min-w-0 w-full justify-center"
                  variants={{
                    hidden: { x: 120, opacity: 0, transition: exitTransition },
                    show: { x: 0, opacity: 1, transition },
                  }}
                >
                  <div className="focus-directory-stage w-full min-w-0 max-w-xl">
                    <DirectoryBrowser
                      section={focused}
                      color={colors[focused.key] ?? focused.color}
                      activeProject={activeProject}
                      focusTarget={focusTarget}
                      onOpenProject={(id) => toggleOpen(focused.key, id)}
                      onAddProject={() => handleAddProject(focused.key)}
                      onAddEnvelope={(pid) => handleAddEnvelope(focused.key, pid)}
                      onCreateFile={(pid, envId, item) =>
                        handleCreateFile(focused.key, pid, envId, item)
                      }
                      onRenameProject={(id, name) =>
                        handleRenameProject(focused.key, id, name)
                      }
                      onRenameEnvelope={(pid, envId, name) =>
                        handleRenameEnvelope(focused.key, pid, envId, name)
                      }
                      onDeleteEnvelope={(pid, envId) =>
                        handleDeleteEnvelope(focused.key, pid, envId)
                      }
                      onRenameItem={(pid, envId, itemId, name) =>
                        handleRenameItem(focused.key, pid, envId, itemId, name)
                      }
                      onUpdateFileContent={(pid, envId, itemId, content) =>
                        handleUpdateFileContent(focused.key, pid, envId, itemId, content)
                      }
                      onRemoveItem={(pid, envId, itemId) =>
                        handleRemoveItem(focused.key, pid, envId, itemId)
                      }
                      onDeleteProject={(id) => handleRemoveProject(focused.key, id)}
                      onGroupItems={(pid, itemIds) =>
                        handleGroupItems(focused.key, pid, itemIds)
                      }
                      onClose={exitFocus}
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload tray — live progress for large files, with pause/resume + cancel */}
      <div className="drawers-upload-tray pointer-events-none fixed inset-x-0 z-[70] px-4">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2">
          <AnimatePresence>
            {Object.values(uploads).map((task) => {
              const percent =
                task.chunkCount > 0
                  ? Math.min(100, Math.round((task.uploaded / task.chunkCount) * 100))
                  : 0;
              const uploadedBytes = Math.min(task.uploaded * task.chunkSize, task.size);
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={reduce ? { duration: 0.01 } : { duration: 0.2, ease: "easeOut" }}
                  className="pointer-events-auto w-full rounded-xl border border-border bg-surface/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-accent/10 text-accent">
                      {task.status === "running" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : task.status === "paused" ? (
                        <Pause className="size-4 text-text-muted" />
                      ) : (
                        <File className="size-4 text-red-500 dark:text-red-400" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">
                        {task.name}
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {task.status === "failed"
                          ? task.error ?? "Upload failed"
                          : task.status === "paused"
                            ? `Paused — ${percent}% uploaded`
                            : `${percent}% · ${formatMb(uploadedBytes)} of ${formatMb(task.size)}`}
                      </span>
                    </span>
                    {task.status !== "failed" && (
                      <button
                        type="button"
                        onClick={() => togglePauseUpload(task.id)}
                        aria-label={
                          task.status === "paused" ? "Resume upload" : "Pause upload"
                        }
                        title={task.status === "paused" ? "Resume" : "Pause"}
                        className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-text-muted transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {task.status === "paused" ? (
                          <Play className="size-3.5" />
                        ) : (
                          <Pause className="size-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void cancelUpload(task.id)}
                      aria-label={`Cancel upload of ${task.name}`}
                      title={task.status === "failed" ? "Dismiss" : "Cancel"}
                      className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-500/40 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent/15">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
