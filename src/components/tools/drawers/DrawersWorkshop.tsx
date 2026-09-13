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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, PlugZap } from "lucide-react";
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

type FocusTarget = { envelopeId: string | null; fileId: string } | null;

type DriveState = {
  enabled: boolean;
  connected: boolean;
  googleEmail: string | null;
  syncing: boolean;
};

type CreateItem = Omit<DirItem, "id"> & { file?: File };

export default function DrawersWorkshop({
  sections: initialSections,
  driveEnabled = false,
}: {
  sections: DemoSection[];
  driveEnabled?: boolean;
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

  /* ---- Google Drive layer -------------------------------------------------
     When a connection is live, every mutation goes through the Drive API and
     the section tree is re-synced afterwards. Without a connection (or when
     Drive isn't configured) the in-memory demo behaves exactly as before. */

  const [drive, setDrive] = useState<DriveState>({
    enabled: driveEnabled,
    connected: false,
    googleEmail: null,
    syncing: false,
  });
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const sectionFolderIds = useRef<Record<string, string>>({});
  const noticeTimer = useRef<number | null>(null);

  const driveMode = drive.enabled && drive.connected;

  const notify = (message: string | null) => {
    setDriveNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    if (message) {
      noticeTimer.current = window.setTimeout(() => setDriveNotice(null), 5000);
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

  const refreshSection = async (sectionKey: string) => {
    const res = await api(
      `/api/drive/tree?section=${encodeURIComponent(sectionKey)}`,
    );
    const data = (await res.json()) as {
      section: DemoSection;
      sectionFolderId: string;
    };
    sectionFolderIds.current[sectionKey] = data.sectionFolderId;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey ? { ...data.section, key: s.key } : s,
      ),
    );
  };

  const runDrive = async (
    label: string,
    sectionKey: string,
    action: () => Promise<Response>,
  ) => {
    try {
      await action();
      await refreshSection(sectionKey);
    } catch (error) {
      notify(error instanceof Error ? error.message : `Failed to ${label}.`);
    }
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

  const driveAddProject = (sectionKey: string) => {
    const parentId = sectionFolderIds.current[sectionKey];
    if (!parentId) return;
    const name = `Drawer ${sectionCount(sectionKey) + 1}`;
    void runDrive("create drawer", sectionKey, () =>
      api("/api/drive/folders", {
        method: "POST",
        body: JSON.stringify({ parentId, name }),
      }),
    );
  };

  const driveRenameFolder = (sectionKey: string, id: string, name: string) => {
    void runDrive("rename", sectionKey, () =>
      api(`/api/drive/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    );
  };

  const driveDeleteFolder = (sectionKey: string, id: string) => {
    void runDrive("delete", sectionKey, () =>
      api(`/api/drive/folders/${id}`, { method: "DELETE" }),
    );
  };

  const driveAddEnvelope = (sectionKey: string, projectId: string) => {
    const name = `Envelope ${envelopeCount(sectionKey, projectId) + 1}`;
    void runDrive("create envelope", sectionKey, () =>
      api("/api/drive/folders", {
        method: "POST",
        body: JSON.stringify({ parentId: projectId, name }),
      }),
    );
  };

  const driveQuickAddItem = (sectionKey: string, projectId: string) => {
    const name = `file ${looseFileCount(sectionKey, projectId) + 1}`;
    void runDrive("create file", sectionKey, () =>
      api("/api/drive/files/json", {
        method: "POST",
        body: JSON.stringify({ parentId: projectId, name, type: "FILE" }),
      }),
    );
  };

  const driveCreateFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    item: CreateItem,
  ) => {
    const parentId = envelopeId ?? projectId;
    const action = () => {
      if (item.file) {
        const form = new FormData();
        form.set("parentId", parentId);
        form.set("name", item.name);
        form.set("file", item.file);
        return api("/api/drive/files", { method: "POST", body: form });
      }
      const isLink = item.type === "LINK";
      return api("/api/drive/files/json", {
        method: "POST",
        body: JSON.stringify({
          parentId,
          name: item.name,
          type: item.type,
          ...(!isLink && item.content ? { content: item.content } : {}),
          ...(isLink && item.content ? { link: item.content } : {}),
        }),
      });
    };
    void runDrive("create file", sectionKey, action);
  };

  const driveRenameItem = (
    sectionKey: string,
    _projectId: string,
    _envelopeId: string | null,
    itemId: string,
    name: string,
  ) => {
    void runDrive("rename", sectionKey, () =>
      api(`/api/drive/files/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    );
  };

  const driveUpdateFileContent = (
    sectionKey: string,
    _projectId: string,
    _envelopeId: string | null,
    itemId: string,
    content: string,
  ) => {
    void runDrive("save content", sectionKey, () =>
      api(`/api/drive/files/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    );
  };

  const driveRemoveItem = (
    sectionKey: string,
    _projectId: string,
    _envelopeId: string | null,
    itemId: string,
  ) => {
    void runDrive("delete", sectionKey, () =>
      api(`/api/drive/files/${itemId}`, { method: "DELETE" }),
    );
  };

  const driveGroupItems = (
    sectionKey: string,
    projectId: string,
    itemIds: string[],
  ) => {
    const name = `Envelope ${envelopeCount(sectionKey, projectId) + 1}`;
    void (async () => {
      try {
        const res = await api("/api/drive/folders", {
          method: "POST",
          body: JSON.stringify({ parentId: projectId, name }),
        });
        const { id: envelopeId } = (await res.json()) as { id: string };
        for (const fileId of itemIds) {
          await api(`/api/drive/files/${fileId}/move`, {
            method: "POST",
            body: JSON.stringify({ parentId: envelopeId, oldParentId: projectId }),
          });
        }
        await refreshSection(sectionKey);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Failed to group files.");
      }
    })();
  };

  const connectDrive = async () => {
    try {
      const res = await api("/api/drive/auth-url");
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.assign(url);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to connect.");
    }
  };

  const disconnectDrive = async () => {
    try {
      await api("/api/drive/disconnect", { method: "POST" });
      setDrive((d) => ({ ...d, connected: false, googleEmail: null }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to disconnect.");
    }
  };

  const fetchDriveContent = async (fileId: string): Promise<string> => {
    const res = await api(`/api/drive/files/${fileId}/content`);
    return res.text();
  };

  useEffect(() => {
    if (!driveEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const status = (await api("/api/drive/status").then((r) => r.json())) as {
          enabled: boolean;
          connected: boolean;
          googleEmail: string | null;
        };
        if (cancelled) return;
        if (!status.connected) {
          setDrive({ enabled: status.enabled, connected: false, googleEmail: null, syncing: false });
          return;
        }
        setDrive({ enabled: true, connected: true, googleEmail: status.googleEmail, syncing: true });
        for (const key of initialSections.map((s) => s.key)) {
          if (cancelled) return;
          await refreshSection(key).catch(() => undefined);
        }
        if (!cancelled) setDrive((d) => ({ ...d, syncing: false }));
      } catch {
        if (!cancelled) setDrive((d) => ({ ...d, enabled: true, syncing: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveEnabled]);

  /* Handlers choose between the Drive API and the local demo. */
  const handleAddProject = (sectionKey: string) => {
    if (driveMode) return driveAddProject(sectionKey);
    addProject(sectionKey);
  };
  const handleRemoveProject = (sectionKey: string, id: string) => {
    if (driveMode) return driveDeleteFolder(sectionKey, id);
    removeProject(sectionKey, id);
  };
  const handleAddEnvelope = (sectionKey: string, projectId: string) => {
    if (driveMode) return driveAddEnvelope(sectionKey, projectId);
    addEnvelope(sectionKey, projectId);
  };
  const handleAddItem = (sectionKey: string, projectId: string) => {
    if (driveMode) return driveQuickAddItem(sectionKey, projectId);
    addItem(sectionKey, projectId);
  };
  const handleRenameProject = (sectionKey: string, id: string, name: string) => {
    if (driveMode) return driveRenameFolder(sectionKey, id, name);
    renameProject(sectionKey, id, name);
  };
  const handleRenameEnvelope = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    name: string,
  ) => {
    if (driveMode) {
      if (envelopeId) driveRenameFolder(sectionKey, envelopeId, name);
      return;
    }
    if (envelopeId) renameEnvelope(sectionKey, projectId, envelopeId, name);
  };
  const handleCreateFile = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    item: CreateItem,
  ) => {
    if (driveMode) return driveCreateFile(sectionKey, projectId, envelopeId, item);
    createFile(sectionKey, projectId, envelopeId, item);
  };
  const handleRenameItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    name: string,
  ) => {
    if (driveMode) return driveRenameItem(sectionKey, projectId, envelopeId, itemId, name);
    renameItem(sectionKey, projectId, envelopeId, itemId, name);
  };
  const handleUpdateFileContent = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    content: string,
  ) => {
    if (driveMode) return driveUpdateFileContent(sectionKey, projectId, envelopeId, itemId, content);
    updateFileContent(sectionKey, projectId, envelopeId, itemId, content);
  };
  const handleRemoveItem = (
    sectionKey: string,
    projectId: string,
    envelopeId: string | null,
    itemId: string,
  ) => {
    if (driveMode) return driveRemoveItem(sectionKey, projectId, envelopeId, itemId);
    removeFile(sectionKey, projectId, envelopeId, itemId);
  };
  const handleGroupItems = (sectionKey: string, projectId: string, itemIds: string[]) => {
    if (driveMode) return driveGroupItems(sectionKey, projectId, itemIds);
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
      {driveEnabled && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          {drive.connected ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <Check className="size-3.5" />
                Google Drive
              </span>
              {drive.googleEmail && (
                <span className="text-xs text-text-muted">
                  {drive.googleEmail}
                </span>
              )}
              <button
                type="button"
                onClick={disconnectDrive}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-text"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-text-muted">
                Files stay in your browser for now.
              </span>
              <button
                type="button"
                onClick={connectDrive}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-150 ease-out hover:scale-[1.03] hover:brightness-110 active:scale-95"
              >
                <PlugZap className="size-3.5" />
                Connect Google Drive
              </button>
            </>
          )}
          {drive.syncing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted italic">
              <Loader2 className="size-3.5 animate-spin" />
              Syncing drawers…
            </span>
          )}
          {driveNotice && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              {driveNotice}
            </span>
          )}
        </div>
      )}

      <div className="grid items-end justify-items-center gap-20 lg:grid-cols-2">
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
                  onAddProject={() => handleAddProject(focused.key)}
                  onRemoveProject={(id) => handleRemoveProject(focused.key, id)}
                  onAddEnvelope={(pid) => handleAddEnvelope(focused.key, pid)}
                  onAddItem={(pid) => handleAddItem(focused.key, pid)}
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
                    cloudMode={driveMode}
                    fetchContent={driveMode ? fetchDriveContent : undefined}
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
