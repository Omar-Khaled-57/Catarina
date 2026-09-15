// GET    /api/tables/[id] — fetch a single table
// PATCH  /api/tables/[id] — update name/color/cells/stickers/isDateBased
// DELETE /api/tables/[id] — soft-delete (admin OR created-by OR section-writer)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext, jsonError, asString, asBoolean } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";
import { canWriteTable } from "@/lib/table/table-permissions";
import { MAX_GRID_SIZE } from "@/lib/table/grid";

/** JSON columns come back either as a JSON-encoded string (Prisma-written) or
    already parsed (raw-libsql-written). Normalize to the parsed value. */
function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return (v as T) ?? fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

interface Params {
  params: Promise<{ id: string }>;
}

async function findTable(id: string) {
  return prisma.teamTable.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const table = await findTable(id);
  if (!table) return jsonError("Table not found", 404);

  if (!canWriteTable(auth.data, table) &&
      !(auth.data.role === ROLE_ADMIN || auth.data.sections.includes(table.section))) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json({
    table: {
      id: table.id,
      section: table.section,
      name: table.name,
      color: table.color,
      cells: parseJson(table.cells, { rows: [[]], cols: 1 }),
      stickers: parseJson(table.stickers, []),
      isDateBased: table.isDateBased,
      createdById: table.createdById,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const table = await findTable(id);
  if (!table) return jsonError("Table not found", 404);

  if (!canWriteTable(auth.data, table)) {
    return jsonError("You don't have permission to edit this table", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = asString(body.name, 200);
    if (!name) return jsonError("Invalid table name", 400);
    data.name = name;
  }

  if (body.color !== undefined) {
    const color = asString(body.color, 20);
    if (!color) return jsonError("Invalid color", 400);
    data.color = color;
  }

  if (body.isDateBased !== undefined) {
    const isDateBased = asBoolean(body.isDateBased);
    if (isDateBased === null) return jsonError("Invalid isDateBased", 400);
    data.isDateBased = isDateBased;
  }

  if (body.cells !== undefined) {
    if (typeof body.cells !== "object" || body.cells === null) {
      return jsonError("Invalid cells", 400);
    }
    const cells = body.cells as { rows?: unknown[][]; cols?: number };
    if (!Array.isArray(cells.rows) || typeof cells.cols !== "number") {
      return jsonError("Invalid cells structure", 400);
    }
    if (cells.rows.length > MAX_GRID_SIZE || cells.cols > MAX_GRID_SIZE) {
      return jsonError(`Grid exceeds maximum size of ${MAX_GRID_SIZE}×${MAX_GRID_SIZE}`, 400);
    }
    data.cells = JSON.stringify(cells);
  }

  if (body.stickers !== undefined) {
    if (!Array.isArray(body.stickers)) {
      return jsonError("Invalid stickers", 400);
    }
    data.stickers = JSON.stringify(body.stickers);
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No fields to update", 400);
  }

  const updated = await prisma.teamTable.update({
    where: { id },
    data,
    select: {
      id: true,
      section: true,
      name: true,
      color: true,
      isDateBased: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ table: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const table = await findTable(id);
  if (!table) return jsonError("Table not found", 404);

  // Admin OR creator OR section writer can delete
  const isCreator = table.createdById === auth.data.id;
  const isSectionWriter = canWriteTable(auth.data, table);
  if (auth.data.role !== ROLE_ADMIN && !isCreator && !isSectionWriter) {
    return jsonError("You don't have permission to delete this table", 403);
  }

  await prisma.teamTable.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
