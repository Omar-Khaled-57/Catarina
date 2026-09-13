// GET /api/drive/tree?section=KEY — Full drawer tree for one section from Drive.
// Provisions the section folder on demand, then maps Drive folders/files to the
// drawer model: section → drawers (folders) → envelopes (folders) + items.

import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { getSections } from "@/lib/sections";
import {
  getDriveConnection,
  getSectionTree,
  isDriveEnabled,
  ensureRootFolder,
  ensureSectionFolder,
} from "@/lib/drive";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const section = request.nextUrl.searchParams.get("section")?.toUpperCase();
  if (!section) return jsonError("section is required", 400);

  const sections = await getSections();
  const sectionDef = sections.find((s) => s.key === section);
  if (!sectionDef) return jsonError("Unknown section", 404);

  if (!isDriveEnabled()) return jsonError("Google Drive is not configured", 400);

  const conn = await getDriveConnection(auth.data.userId);
  if (!conn) return jsonError("Connect Google Drive first", 400);

  const rootId = await ensureRootFolder(conn);
  const sectionFolderId = await ensureSectionFolder(
    conn,
    rootId,
    sectionDef.key,
    sectionDef.label
  );
  const tree = await getSectionTree(conn, sectionDef.key, sectionDef.label, sectionDef.color);
  return NextResponse.json({ section: tree, sectionFolderId });
}