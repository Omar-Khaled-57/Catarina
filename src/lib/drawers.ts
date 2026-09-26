/**
 * Turso-backed team workspace for The Drawers.
 *
 * One shared workspace per section: the full drawer tree (projects →
 * envelopes → items, with text/link/image content embedded) is stored as
 * JSON in a `DrawerSection` row. Every authenticated teammate reads and
 * writes the same space — no OAuth, no consent screen, no external storage.
 *
 * Section identity (key/label/color) always comes from the live section
 * registry so the chest palette stays in sync with the dashboard.
 */

import { prisma } from "@/lib/prisma";
import { getSections } from "@/lib/sections";
import {
  getUploadStore,
  isWorkspaceFileType,
  workspaceUsedBytes,
  MAX_WORKSPACE_BYTES,
} from "@/lib/workspaceFiles";
import type {
  DemoProject,
  DemoSection,
  DirItem,
  EnvelopeData,
} from "@/components/tools/drawers/types";

export function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

/** A concurrent teammate won the write we just lost — the mutation is refused
 *  (409) instead of silently overwriting their change. */
export class DrawerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawerConflictError";
  }
}

/** The shared store is at its byte ceiling, so this write is refused (413)
 *  rather than filling the database every other section reads from. */
export class DrawerQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawerQuotaError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** The current section definition for a key, or null when unknown. */
export async function getSectionDef(sectionKey: string) {
  const sections = await getSections();
  return sections.find((s) => s.key === normalizeKey(sectionKey)) ?? null;
}

/** Stored drawer projects for a section (empty list when none exist yet). */
export async function loadTree(sectionKey: string): Promise<DemoProject[]> {
  return (await loadTreeWithVersion(sectionKey)).projects;
}

/** Projects plus the version the write side must compare-and-swap against.
 *  `treeLength` is the stored tree's current size in the same unit the quota
 *  check uses, so the write side can project the post-write store total
 *  exactly instead of guessing the delta. */
export async function loadTreeWithVersion(
  sectionKey: string,
): Promise<{ projects: DemoProject[]; version: number; treeLength: number }> {
  const row = await prisma.drawerSection.findUnique({
    where: { key: normalizeKey(sectionKey) },
    select: { tree: true, version: true },
  });
  if (!row) return { projects: [], version: 0, treeLength: 0 };
  const treeLength = storedTreeLength(row.tree);
  try {
    const parsed: unknown = JSON.parse(row.tree);
    return {
      projects: Array.isArray(parsed) ? (parsed as DemoProject[]) : [],
      version: row.version,
      treeLength,
    };
  } catch {
    return { projects: [], version: row.version, treeLength };
  }
}

/** Measure a tree string the same way SQLite's `LENGTH()` does (UTF-8 code
 *  points, not UTF-16 units) so the projection matches the stored total that
 *  `workspaceUsedBytes` reports. */
function storedTreeLength(tree: string): number {
  return Array.from(tree).length;
}

/** Persist a tree only if it still sits on the version we loaded from. A stale
 *  write (another teammate won first) throws DrawerConflictError instead of
 *  overwriting their change. */
async function saveTree(
  sectionKey: string,
  projects: DemoProject[],
  version: number,
  previousTreeLength: number,
): Promise<void> {
  const key = normalizeKey(sectionKey);
  const tree = JSON.stringify(projects);

  /* Shared-store byte ceiling, enforced on EVERY tree write — not just
     chunked uploads. The inline path (createItem / updateItemContent) also
     stores its payload in this row, so before it was guarded a single member
     could loop multi-megabyte writes and fill the database the whole app
     reads from. The projection is exact: the stored total already includes
     this section's previous tree, so replacing it is total - previous + new. */
  const client = getUploadStore();
  if (client) {
    const used = await workspaceUsedBytes(client);
    const projected = used - previousTreeLength + storedTreeLength(tree);
    if (projected > MAX_WORKSPACE_BYTES) {
      throw new DrawerQuotaError(
        "The shared workspace is full — delete some drawer files before saving more.",
      );
    }
  }

  if (version === 0) {
    /* No row existed when we read — claim it. If someone created it between
       our read and this write, fall through to the CAS update below. */
    try {
      await prisma.drawerSection.create({ data: { key, tree, version: 1 } });
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  const result = await prisma.drawerSection.updateMany({
    where: { key, version },
    data: { tree, version: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw new DrawerConflictError(
      "Another teammate changed this drawer at the same time, so your change wasn't saved.",
    );
  }
}

/* ─── Item type used by the mutate API ────────────────────────────────────── */

export interface DrawerItemInput {
  name: string;
  type: DirItem["type"];
  content?: string;
}

/* ─── Pure tree transforms ────────────────────────────────────────────────── */

const newId = () => crypto.randomUUID();

function findProject(projects: DemoProject[], projectId: string) {
  return projects.find((p) => p.id === projectId) ?? null;
}

function patchProjectItems(
  projects: DemoProject[],
  projectId: string,
  envelopeId: string | null,
  patch: (items: DirItem[]) => DirItem[],
): DemoProject[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    if (envelopeId) {
      return {
        ...p,
        envelopes: p.envelopes.map((e) =>
          e.id === envelopeId ? { ...e, items: patch(e.items ?? []) } : e,
        ),
      };
    }
    return { ...p, items: patch(p.items ?? []) };
  });
}

function insertItem(
  projects: DemoProject[],
  projectId: string,
  envelopeId: string | null,
  item: DirItem,
): DemoProject[] {
  return patchProjectItems(
    projects,
    projectId,
    envelopeId,
    (items) => [...items, item],
  );
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : "")).filter(Boolean);
}

export function applyDrawerAction(
  projects: DemoProject[],
  action: string,
  payload: Record<string, unknown>,
): DemoProject[] {
  const projectId = trim(payload.projectId);
  const envelopeId = trim(payload.envelopeId) || null;
  const itemId = trim(payload.itemId);

  switch (action) {
    case "createProject": {
      const name = trim(payload.name) || `Drawer ${projects.length + 1}`;
      return [...projects, { id: newId(), name, envelopes: [] }];
    }

    case "renameProject": {
      const name = trim(payload.name);
      return projects.map((p) =>
        p.id === projectId ? { ...p, name: name || p.name } : p,
      );
    }

    case "deleteProject": {
      return projects.filter((p) => p.id !== projectId);
    }

    case "addEnvelope": {
      const project = findProject(projects, projectId);
      if (!project) return projects;
      const name = trim(payload.name) || `Envelope ${project.envelopes.length + 1}`;
      return projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              envelopes: [
                ...p.envelopes,
                { id: newId(), name, items: [] } as EnvelopeData,
              ],
            }
          : p,
      );
    }

    case "renameEnvelope": {
      const name = trim(payload.name);
      return projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              envelopes: p.envelopes.map((e) =>
                e.id === envelopeId ? { ...e, name: name || e.name } : e,
              ),
            }
          : p,
      );
    }

    case "deleteEnvelope": {
      return projects.map((p) =>
        p.id === projectId
          ? { ...p, envelopes: p.envelopes.filter((e) => e.id !== envelopeId) }
          : p,
      );
    }

    case "createItem": {
      const project = findProject(projects, projectId);
      if (!project) return projects;
      const raw = payload.item;
      const name = trim((raw as DrawerItemInput | undefined)?.name);
      /* Only known types may enter the shared tree — an unknown string would
         drive the client with a type it can't render. */
      const rawType = (raw as DrawerItemInput | undefined)?.type;
      const type = isWorkspaceFileType(rawType) ? rawType : "FILE";
      const content = (raw as DrawerItemInput | undefined)?.content;
      /* The server always assigns the id — a client-supplied one could be
         duplicated or collide with existing items in the shared tree. The
         chunked-upload path has its own dedicated inserter below. */
      const item: DirItem = {
        id: newId(),
        name: name || `file ${(project.items?.length ?? 0) + 1}`,
        type,
        ...(typeof content === "string" && content ? { content } : {}),
      };
      return insertItem(projects, projectId, envelopeId, item);
    }

    case "renameItem": {
      const name = trim(payload.name);
      return patchProjectItems(projects, projectId, envelopeId, (items) =>
        items.map((it) => (it.id === itemId ? { ...it, name: name || it.name } : it)),
      );
    }

    case "updateItemContent": {
      /* Store the content verbatim — trimming it would destroy meaningful
         whitespace in notes/code. Trim is only used to detect "cleared". */
      const raw = typeof payload.content === "string" ? payload.content : "";
      const hasContent = raw.trim().length > 0;
      return patchProjectItems(projects, projectId, envelopeId, (items) =>
        items.map((it) =>
          it.id === itemId
            ? { ...it, ...(hasContent ? { content: raw } : { content: undefined }) }
            : it,
        ),
      );
    }

    case "removeItem": {
      return patchProjectItems(projects, projectId, envelopeId, (items) =>
        items.filter((it) => it.id !== itemId),
      );
    }

    case "groupItems": {
      const project = findProject(projects, projectId);
      if (!project) return projects;
      const itemIds = asArray(payload.itemIds);
      const loose = project.items ?? [];
      const moved = loose.filter((it) => itemIds.includes(it.id));
      if (moved.length === 0) return projects;
      const envelope: EnvelopeData = {
        id: newId(),
        name: trim(payload.name) || `Envelope ${project.envelopes.length + 1}`,
        items: moved,
      };
      return projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              envelopes: [...p.envelopes, envelope],
              items: loose.filter((it) => !itemIds.includes(it.id)),
            }
          : p,
      );
    }

    default:
      throw new Error(`Unknown drawer action: ${action}`);
  }
}

/** Load, transform, persist and return the refreshed section — without a
 *  second tree read: the caller already resolved the live section definition
 *  (a cached registry lookup), and the transformed projects are exactly what
 *  was just saved. */
export async function mutateSection(
  def: NonNullable<Awaited<ReturnType<typeof getSectionDef>>>,
  action: string,
  payload: Record<string, unknown>,
): Promise<DemoSection> {
  const { projects, version, treeLength } = await loadTreeWithVersion(def.key);
  const next = applyDrawerAction(projects, action, payload);
  await saveTree(def.key, next, version, treeLength);
  return { key: def.key, label: def.label, color: def.color, projects: next };
}

/**
 * Insert a NEW item with a server-assigned id (used by chunked-upload
 * completion, where the assembled file must be linked to a known item id).
 */
export async function insertItemIntoSection(
  def: NonNullable<Awaited<ReturnType<typeof getSectionDef>>>,
  projectId: string,
  envelopeId: string | null,
  itemId: string,
  item: DrawerItemInput,
): Promise<DemoSection> {
  const { projects, version, treeLength } = await loadTreeWithVersion(def.key);
  const project = findProject(projects, projectId);
  const fresh: DirItem = {
    id: itemId,
    name: trim(item.name) || `file ${(project?.items?.length ?? 0) + 1}`,
    type: item.type,
    ...(typeof item.content === "string" && item.content ? { content: item.content } : {}),
  };
  const next = insertItem(projects, projectId, envelopeId, fresh);
  await saveTree(def.key, next, version, treeLength);
  return { key: def.key, label: def.label, color: def.color, projects: next };
}