/**
 * Google Drive integration for the Drawers feature.
 *
 * Free tier: every caller uses their own Google account (per-user OAuth, the
 * `drive` scope). A single shared "Catarina" root folder lives on Drive and is
 * shared with every connected teammate, so one space is visible to all.
 *
 * Drive is the source of truth: section → root subfolder, drawer (project) →
 * folder, envelope → folder, item → file. Item types survive round-trips via a
 * small metadata header in the file's `description` field.
 *
 * OAuth tokens are encrypted at rest (AES-256-GCM) — only Google ever sees a
 * raw token. Access tokens are auto-refreshed with the stored refresh token.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { DirItem, DemoSection, EnvelopeData } from "@/components/tools/drawers/types";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Catarina";
const CONF_ROOT = "drive.rootFolderId";
const CONF_SECTION_PREFIX = "drive.sectionFolder.";

/* File name extensions used to classify text items as CODE. */
const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".css", ".html", ".htm", ".svg", ".py", ".rb",
  ".go", ".rs", ".java", ".c", ".cpp", ".h", ".php", ".sh", ".bash", ".sql",
  ".graphql", ".proto", ".prisma",
]);

/* ─── Config ───────────────────────────────────────────────────────────────── */

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** OAuth settings, or null when Drive is not configured (demo fallback). */
export function getDriveConfig(): DriveConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/drive/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isDriveEnabled(): boolean {
  return getDriveConfig() !== null;
}

/* ─── Token encryption (AES-256-GCM) ──────────────────────────────────────── */

function tokenKey(): Buffer {
  const secret = process.env.DRIVE_TOKEN_KEY;
  if (!secret) {
    throw new Error(
      "DRIVE_TOKEN_KEY is not set. Add a random string to .env — it encrypts stored Google Drive tokens."
    );
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a secret to "iv.base64:tag.base64:ciphertext.base64". */
export function encryptSecret(plain: string): string {
  const key = tokenKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** Decrypt a payload produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/* ─── Persisted connection ─────────────────────────────────────────────────── */

export interface DriveTokens {
  accessToken: string;
  refreshToken: string;
  /** Expiry as epoch ms. */
  expiresAt: number;
}

export interface DriveConnection {
  userId: string;
  googleEmail: string;
  tokens: DriveTokens;
}

export async function getDriveConnection(userId: string): Promise<DriveConnection | null> {
  const row = await prisma.driveConnection.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    userId,
    googleEmail: row.googleEmail,
    tokens: {
      accessToken: decryptSecret(row.encryptedAccessToken),
      refreshToken: decryptSecret(row.encryptedRefreshToken),
      expiresAt: row.tokenExpiresAt.getTime(),
    },
  };
}

export async function saveDriveConnection(
  userId: string,
  googleEmail: string,
  tokens: DriveTokens
): Promise<void> {
  await prisma.driveConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleEmail,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: new Date(tokens.expiresAt),
    },
    update: {
      googleEmail,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: new Date(tokens.expiresAt),
    },
  });
}

export async function updateDriveTokens(userId: string, tokens: DriveTokens): Promise<void> {
  await prisma.driveConnection.updateMany({
    where: { userId },
    data: {
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: new Date(tokens.expiresAt),
    },
  });
}

export async function clearDriveConnection(userId: string): Promise<void> {
  await prisma.driveConnection.deleteMany({ where: { userId } });
}

/* ─── OAuth flow ───────────────────────────────────────────────────────────── */

export function buildDriveAuthUrl(state: string): string | null {
  const cfg = getDriveConfig();
  if (!cfg) return null;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface ExchangeResult {
  googleEmail: string;
  tokens: DriveTokens;
}

/** Exchange an authorization code for tokens, returning them with the account email. */
export async function exchangeDriveCode(code: string): Promise<ExchangeResult> {
  const cfg = getDriveConfig();
  if (!cfg) throw new DriveError("Google Drive is not configured", 500);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new DriveError(data.error_description ?? data.error ?? "Failed to exchange code", res.status);
  }

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userInfo = (await userRes.json()) as { email?: string };
  if (!userRes.ok || !userInfo.email) {
    throw new DriveError("Failed to read the connected Google account", userRes.status);
  }

  return {
    googleEmail: userInfo.email,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    },
  };
}

/* ─── Drive API plumbing ───────────────────────────────────────────────────── */

export class DriveError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

async function refreshDriveTokens(conn: DriveConnection, cfg: DriveConfig): Promise<DriveTokens> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.tokens.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    /* A revoked/expired refresh token can't be refreshed. */
    if (res.status === 400 || res.status === 401) {
      throw new DriveError("Your Google Drive connection has expired — please reconnect.", 401);
    }
    throw new DriveError(data.error_description ?? data.error ?? "Failed to refresh token", res.status);
  }
  await updateDriveTokens(conn.userId, {
    ...conn.tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return {
    ...conn.tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

/** Authenticated fetch against the Drive files API with transparent refresh. */
async function driveFetch(
  conn: DriveConnection,
  method: string,
  path: string,
  init: { body?: BodyInit; contentType?: string } = {}
): Promise<Response> {
  const cfg = getDriveConfig();
  if (!cfg) throw new DriveError("Google Drive is not configured", 500);

  let tokens = conn.tokens;
  if (Date.now() >= tokens.expiresAt - 60_000) {
    tokens = await refreshDriveTokens(conn, cfg);
  }

  const doFetch = (accessToken: string): Promise<Response> =>
    fetch(`${FILES_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      body: init.body,
    });

  let res = await doFetch(tokens.accessToken);
  if (res.status === 401) {
    tokens = await refreshDriveTokens(conn, cfg);
    res = await doFetch(tokens.accessToken);
  }
  return res;
}

async function driveJson(
  conn: DriveConnection,
  method: string,
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const res = await driveFetch(conn, method, path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    contentType: body === undefined ? undefined : "application/json; charset=UTF-8",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: number };
  };
  if (!res.ok || data.error) {
    throw new DriveError(data.error?.message ?? "Google Drive request failed", res.status);
  }
  return data;
}

/* ─── Drive file metadata helpers ──────────────────────────────────────────── */

interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  description?: string | null;
  parents?: string[];
}

const isFolder = (f: DriveFileMeta) => f.mimeType === FOLDER_MIME;

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/* ─── Item metadata round-trip (Drive `description`) ──────────────────────── */

const DESC_TAG = "catarina:1";

function buildDescription(type: DirItem["type"], link?: string): string {
  return [DESC_TAG, `type=${type}`, ...(link ? [`link=${link}`] : [])].join("\n");
}

function parseDescription(description?: string | null): { type?: DirItem["type"]; link?: string } {
  if (!description) return {};
  const lines = description.split("\n");
  if (lines[0]?.trim() !== DESC_TAG) return {};
  let type: DirItem["type"] | undefined;
  let link: string | undefined;
  for (const line of lines) {
    if (line.startsWith("type=")) {
      const t = line.slice(5).trim();
      const valid: DirItem["type"][] = ["CODE", "IMAGE", "FILE", "LINK", "NOTE", "VIDEO"];
      if ((valid as string[]).includes(t)) type = t as DirItem["type"];
    } else if (line.startsWith("link=")) {
      link = line.slice(5).trim();
    }
  }
  return { type, link };
}

/* ─── Classification → DirItem ─────────────────────────────────────────────── */

function classifyType(meta: DriveFileMeta): DirItem["type"] {
  const parsed = parseDescription(meta.description);
  if (parsed.type) return parsed.type;
  if (parsed.link) return "LINK";
  if (meta.mimeType.startsWith("image/")) return "IMAGE";
  if (meta.mimeType.startsWith("video/")) return "VIDEO";
  if (CODE_EXTENSIONS.has(fileExt(meta.name))) return "CODE";
  return "FILE";
}

/** Absolute path the client can fetch to stream this file's bytes. */
function contentProxyUrl(fileId: string): string {
  return `/api/drive/files/${encodeURIComponent(fileId)}/content`;
}

function toDirItem(meta: DriveFileMeta): DirItem {
  const type = classifyType(meta);
  const parsed = parseDescription(meta.description);
  let content: string | undefined;
  if (type === "LINK") content = parsed.link;
  else if (type === "IMAGE" || type === "VIDEO") content = contentProxyUrl(meta.id);
  return { id: meta.id, type, name: meta.name, ...(content ? { content } : {}) };
}

/* ─── Tree building ────────────────────────────────────────────────────────── */

async function readEnvelope(
  conn: DriveConnection,
  folderId: string,
  name: string
): Promise<EnvelopeData> {
  const metas = await listChildren(conn, folderId);
  const items = metas.filter((m) => !isFolder(m)).map(toDirItem);
  return { id: folderId, name, items };
}

async function readDrawer(
  conn: DriveConnection,
  folderId: string
): Promise<{ envelopes: EnvelopeData[]; items: DirItem[] }> {
  const metas = await listChildren(conn, folderId);
  const envelopes = await Promise.all(
    metas.filter((m) => isFolder(m)).map((f) => readEnvelope(conn, f.id, f.name))
  );
  const items = metas.filter((m) => !isFolder(m)).map(toDirItem);
  return { envelopes, items };
}

export async function listChildren(
  conn: DriveConnection,
  folderId: string,
  fields = "files(id,name,mimeType,description),nextPageToken"
): Promise<DriveFileMeta[]> {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields,
    pageSize: "500",
    orderBy: "folder,name",
  });
  const out: DriveFileMeta[] = [];
  let pageToken: string | null = null;
  do {
    if (pageToken) query.set("pageToken", pageToken);
    const data = (await driveJson(conn, "GET", `?${query.toString()}`)) as {
      files?: DriveFileMeta[];
      nextPageToken?: string;
    };
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  return out;
}

export async function getSectionTree(
  conn: DriveConnection,
  key: string,
  label: string,
  color: string
): Promise<DemoSection> {
  const rootId = await ensureRootFolder(conn);
  const sectionFolderId = await ensureSectionFolder(conn, rootId, key, label);
  const metas = await listChildren(conn, sectionFolderId);
  const drawers = metas.filter(isFolder);

  const projects = await Promise.all(
    drawers.map(async (d) => {
      const { envelopes, items } = await readDrawer(conn, d.id);
      return { id: d.id, name: d.name, envelopes, items };
    })
  );

  return { key, label, color, projects };
}

/* ─── Folder provisioning (root + per-section) ─────────────────────────────── */

export async function ensureRootFolder(conn: DriveConnection): Promise<string> {
  /* Optional pre-provisioned override (admin shares it manually in Drive UI). */
  const override = process.env.DRIVE_ROOT_FOLDER_ID;
  if (override) return override;

  const existing = await prisma.appConfig.findUnique({ where: { key: CONF_ROOT } });
  if (existing?.value) return existing.value;

  const res = await driveFetch(conn, "POST", "", {
    body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME, folderColorRgb: "0B57D0" }),
    contentType: "application/json; charset=UTF-8",
  });
  const data = (await res.json()) as { error?: { message?: string }; id?: string };
  if (!res.ok || !data.id) {
    if (data.error?.message) throw new DriveError(data.error.message, res.status);
    throw new DriveError("Failed to create the shared Drive folder", res.status);
  }
  await prisma.appConfig.upsert({
    where: { key: CONF_ROOT },
    create: { key: CONF_ROOT, value: data.id },
    update: { value: data.id },
  });
  await shareRootWithTeam(conn, data.id);
  return data.id;
}

async function shareRootWithTeam(conn: DriveConnection, rootId: string): Promise<void> {
  const others = await prisma.driveConnection.findMany({
    where: { userId: { not: conn.userId } },
    select: { googleEmail: true },
  });
  for (const other of others) {
    try {
      await driveJson(conn, "POST", `/${rootId}/permissions`, {
        role: "writer",
        type: "user",
        emailAddress: other.googleEmail,
      });
    } catch {
      /* Already shared, or the folder isn't writable for this caller — ignore. */
    }
  }
}

export async function ensureSectionFolder(
  conn: DriveConnection,
  rootId: string,
  key: string,
  label: string
): Promise<string> {
  const confKey = `${CONF_SECTION_PREFIX}${key}`;
  const stored = await prisma.appConfig.findUnique({ where: { key: confKey } });
  if (stored?.value) return stored.value;

  /* Reuse an existing folder with a matching name if the config was wiped. */
  const rootChildren = await listChildren(conn, rootId);
  const match = rootChildren.find((c) => isFolder(c) && c.name === label);
  if (match) {
    await prisma.appConfig.upsert({
      where: { key: confKey },
      create: { key: confKey, value: match.id },
      update: { value: match.id },
    });
    return match.id;
  }

  const data = (await driveJson(conn, "POST", "", {
    name: label,
    mimeType: FOLDER_MIME,
    parents: [rootId],
  })) as { id: string };
  await prisma.appConfig.upsert({
    where: { key: confKey },
    create: { key: confKey, value: data.id },
    update: { value: data.id },
  });
  return data.id;
}

/* ─── Item / folder mutations ──────────────────────────────────────────────── */

export async function createFolder(conn: DriveConnection, parentId: string, name: string): Promise<string> {
  const data = (await driveJson(conn, "POST", "", {
    name,
    mimeType: FOLDER_MIME,
    parents: [parentId],
  })) as { id: string };
  return data.id;
}

export async function renameFile(conn: DriveConnection, fileId: string, name: string): Promise<void> {
  await driveJson(conn, "PATCH", `/${fileId}`, { name });
}

/** Move a file into a new parent folder (used by "group into envelope"). */
export async function moveItem(
  conn: DriveConnection,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<void> {
  const qs = new URLSearchParams({ addParents: newParentId, removeParents: oldParentId });
  await driveJson(conn, "PATCH", `/${fileId}?${qs.toString()}`, {});
}

/** Move to trash (recoverable) instead of a permanent delete. */
export async function trashFile(conn: DriveConnection, fileId: string): Promise<void> {
  await driveJson(conn, "PATCH", `/${fileId}`, { trashed: true });
}

export async function createItem(
  conn: DriveConnection,
  opts: {
    parentId: string;
    name: string;
    type: DirItem["type"];
    content?: string;
    link?: string;
  }
): Promise<DirItem> {
  const description = buildDescription(opts.type, opts.type === "LINK" ? opts.link : undefined);
  const isMedia = opts.type === "IMAGE" || opts.type === "VIDEO";
  const mimeType =
    opts.type === "CODE" ? "text/plain"
    : opts.type === "IMAGE" ? "image/png"
    : opts.type === "VIDEO" ? "video/mp4"
    : opts.type === "LINK" ? "text/uri-list"
    : "text/plain";

  const data = (await driveJson(conn, "POST", "", {
    name: opts.name,
    description,
    parents: [opts.parentId],
    mimeType,
  })) as { id: string };

  if (!isMedia && opts.content) {
    await writeItemBody(conn, data.id, opts.content);
  }

  return { id: data.id, type: opts.type, name: opts.name, ...(opts.link ? { content: opts.link } : {}) };
}

/**
 * Upload a raw file (image/video/binary) into a drawer or envelope folder.
 * Type is derived from the uploaded MIME type, kept in the DB-free description.
 */
export async function uploadItem(
  conn: DriveConnection,
  parentId: string,
  name: string,
  mimeType: string,
  fileBytes: Uint8Array
): Promise<DirItem> {
  const mimeBase = mimeType.split("/")[0];
  const type: DirItem["type"] =
    mimeBase === "image" ? "IMAGE" : mimeBase === "video" ? "VIDEO" : "FILE";

  /* Two-step: reserve the file with metadata, then upload the bytes. */
  const description = buildDescription(type);
  const meta = (await driveJson(conn, "POST", "", {
    name,
    description,
    parents: [parentId],
    mimeType: type === "FILE" ? mimeType : type === "VIDEO" ? "video/mp4" : "image/png",
  })) as { id: string };

  const res = await driveFetch(conn, "PATCH", `/${meta.id}?uploadType=media`, {
    body: new Uint8Array(fileBytes) as unknown as BodyInit,
    contentType: mimeType,
  });
  if (!res.ok) {
    await trashFile(conn, meta.id).catch(() => undefined);
    throw new DriveError("Failed to upload the file", res.status);
  }

  return {
    id: meta.id,
    type,
    name,
    ...(type === "IMAGE" || type === "VIDEO" ? { content: contentProxyUrl(meta.id) } : {}),
  };
}

export async function writeItemBody(conn: DriveConnection, fileId: string, content: string): Promise<void> {
  const res = await driveFetch(conn, "PATCH", `/${fileId}?uploadType=media`, {
    body: new TextEncoder().encode(content) as unknown as BodyInit,
    contentType: "text/plain; charset=UTF-8",
  });
  if (!res.ok) throw new DriveError("Failed to save the file content", res.status);
}

export async function updateItem(
  conn: DriveConnection,
  fileId: string,
  opts: { name?: string; type?: DirItem["type"]; content?: string; link?: string }
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (opts.name) updates.name = opts.name;
  if (opts.type || opts.link !== undefined) {
    const current = (await driveJson(conn, "GET", `/${fileId}?fields=description`)) as {
      description?: string;
    };
    const parsed = parseDescription(current.description);
    updates.description = buildDescription(
      opts.type ?? parsed.type ?? "FILE",
      opts.link !== undefined ? opts.link : parsed.link
    );
  }
  if (Object.keys(updates).length > 0) {
    await driveJson(conn, "PATCH", `/${fileId}`, updates);
  }
  if (opts.content !== undefined) {
    await writeItemBody(conn, fileId, opts.content);
  }
}

/* ─── Content read-back ────────────────────────────────────────────────────── */

export async function readItemText(conn: DriveConnection, fileId: string): Promise<string> {
  const res = await driveFetch(conn, "GET", `/${fileId}?alt=media`);
  if (!res.ok) throw new DriveError("Failed to read the file content", res.status);
  return res.text();
}

/** Streaming content response for the client proxy route. */
export async function streamItem(
  conn: DriveConnection,
  fileId: string
): Promise<{ stream: ReadableStream<Uint8Array<ArrayBufferLike>>; contentType: string } | { type: "text-only" } | null> {
  const meta = (await driveJson(conn, "GET", `/${fileId}?fields=mimeType,name`)) as {
    mimeType?: string;
  };

  /* Google Docs/Sheets/Slides have no raw media — export them as text instead. */
  if (meta.mimeType?.startsWith("application/vnd.google-apps.")) {
    const res = await driveFetch(conn, "GET", `/${fileId}/export?mimeType=text/plain`);
    if (!res.ok) return { type: "text-only" };
    const text = await res.text();
    return {
      stream: new ReadableStream<Uint8Array<ArrayBufferLike>>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      }),
      contentType: "text/plain; charset=UTF-8",
    };
  }

  const res = await driveFetch(conn, "GET", `/${fileId}?alt=media`);
  if (!res.ok) return null;
  return {
    stream: res.body as unknown as ReadableStream<Uint8Array<ArrayBufferLike>>,
    contentType: meta.mimeType ?? "application/octet-stream",
  };
}