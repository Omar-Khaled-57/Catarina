// GET    /api/tables/[id] — fetch a single table
// PATCH  /api/tables/[id] — update name/color/cells/stickers/isDateBased
// DELETE /api/tables/[id] — soft-delete (admin OR created-by OR section-writer)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext, jsonError, asString, asBoolean } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rateLimit";
import { canWriteTable } from "@/lib/table/table-permissions";
import { validateCells, validateStickers } from "@/lib/table/tablePayload";

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

  /* Bound table mutations like the drawers mutate route. PATCH/DELETE were
     previously unthrottled while POST was limited, so a single ordinary member
     could loop multi-megabyte writes into the shared database. */
  const limited = await checkRateLimit(
    `mutation:tables:${auth.data.id}`,
    60,
    60_000,
  );
  if (limited.limited) {
    return jsonError("Too many table updates, try again shortly", 429);
  }

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
    const cells = validateCells(body.cells);
    if (!cells.ok) return jsonError(cells.error, 400);
    data.cells = cells.value.serialized;
  }

  if (body.stickers !== undefined) {
    const stickers = validateStickers(body.stickers);
    if (!stickers.ok) return jsonError(stickers.error, 400);
    data.stickers = stickers.value;
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No fields to update", 400);
  }

  /* CAS token the client echoed back: the `updatedAt` of the revision it
     loaded. Required (fail-closed): a save that omits it is stale by
     definition and would clobber a peer — the exact regression this patch
     closes — so we refuse rather than guess. */
  const rawExpected = asString(body.expectedUpdatedAt, 40);
  const expected = rawExpected ? new Date(rawExpected) : null;
  if (!expected || Number.isNaN(expected.getTime())) {
    return jsonError("Missing or invalid updatedAt (CAS token)", 400);
  }

  /* Compare-and-swap on updatedAt: the client must send the `updatedAt` value
     it last loaded (the optimistic-concurrency token, mirroring the drawer
     tree's version CAS). updateMany() — not update() — lets the WHERE clause
     carry the expected token, so a stale writer touches zero rows. Prisma's
     @updatedAt auto-bump DOES NOT fire on updateMany, so we set it explicitly
     — the app reads row.updatedAt back in GET, so manual bump keeps the new
     token form  consumed by the next save. */
  const cas = await prisma.teamTable.updateMany({
    where: { id, updatedAt: expected, deletedAt: null },
    data: { ...data, updatedAt: new Date() },
  });

  if (cas.count === 0) {
    const latest = await findTable(id);
    if (!latest) return jsonError("Table not found", 404);
    /* 409 + the freshest row: the client must rebase (merge its live edits on
       top of the winning document) instead of silently overwriting a peer's
       work — the entire point of the lost-update fix. */
    return NextResponse.json(
      { conflict: true, table: serializeTable(latest) },
      { status: 409 },
    );
  }

  const updated = await findTable(id) as NonNullable<Awaited<ReturnType<typeof findTable>>>;

  return NextResponse.json({ table: serializeTable(updated) });
}

/** Shared table serializer so the 200 and 409 payloads keep the same shape —
 *  cells/stickers are parsed to live objects (like GET) either way. */
function serializeTable(t: NonNullable<Awaited<ReturnType<typeof findTable>>>) {
  return {
    id: t.id,
    section: t.section,
    name: t.name,
    color: t.color,
    cells: parseJson(t.cells, { rows: [[]], cols: 1 }),
    stickers: parseJson(t.stickers, []),
    isDateBased: t.isDateBased,
    createdById: t.createdById ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(
    `mutation:tables:${auth.data.id}`,
    60,
    60_000,
  );
  if (limited.limited) {
    return jsonError("Too many table updates, try again shortly", 429);
  }

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
