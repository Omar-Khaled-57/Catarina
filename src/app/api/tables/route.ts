// GET  /api/tables — list all tables for the user's sections (grouped by section)
// POST /api/tables — create a new table (write-checked per section)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext, jsonError, asString } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rateLimit";
import { canWriteTable } from "@/lib/table/table-permissions";
import { createGrid } from "@/lib/table/grid";
import { isKnownSection } from "@/lib/sections";

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 4;

export async function GET() {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const where: Record<string, unknown> = { deletedAt: null };
  if (auth.data.role !== ROLE_ADMIN) {
    if (auth.data.sections.length === 0) {
      return NextResponse.json({ tables: [] });
    }
    where.section = { in: auth.data.sections };
  }

  const tables = await prisma.teamTable.findMany({
    where,
    orderBy: [{ section: "asc" }, { name: "asc" }],
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

  return NextResponse.json({ tables });
}

export async function POST(req: Request) {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(
    `mutation:tables:${auth.data.id}`,
    20,
    5 * 60_000,
  );
  if (limited.limited) {
    return jsonError("Too many table creations, try again shortly", 429);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const name = asString(body.name, 200);
  const section = asString(body.section, 50);
  if (!name || !section) {
    return jsonError("Name and section are required", 400);
  }

  const color = asString(body.color, 20) || "#00E8A2";

  if (!canWriteTable(auth.data, { section })) {
    return jsonError("You don't have permission to create tables in this section", 403);
  }

  /* The section must name a real, active one. Without this an admin could
     persist "Foo" or "MARKETING " and create a table no member can ever see,
     because membership rows only ever hold canonical uppercase keys. */
  if (!(await isKnownSection(section))) {
    return jsonError("Invalid section", 400);
  }

  const grid = createGrid(DEFAULT_ROWS, DEFAULT_COLS);

  const table = await prisma.teamTable.create({
    data: {
      name,
      section: section.toUpperCase(),
      color,
      cells: JSON.stringify(grid),
      stickers: JSON.stringify([]),
      createdById: auth.data.id,
    },
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

  return NextResponse.json({ table }, { status: 201 });
}
