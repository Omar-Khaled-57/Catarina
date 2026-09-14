// GET /api/drawers/workspace — the full shared drawer workspace for a signed-in
// user: every registered section they belong to (admins see all) with its
// stored tree, in registry order. Guests get a 401 and the client falls back to
// the local demo.

import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/api-helpers";
import { ROLE_ADMIN } from "@/lib/constants";
import { loadTree } from "@/lib/drawers";
import { getSections } from "@/lib/sections";
import type { DemoSection } from "@/components/tools/drawers/types";

export async function GET() {
  const auth = await requireUserContext();
  if (!auth.ok) return auth.response;

  /* Filter the registered sections by the caller's access FIRST, then load
     only their trees — each loadTree is a round trip to the remote store, and
     a member must never fetch a section the dashboard wouldn't let them in. */
  const defs = await getSections();
  const allowed = defs.filter(
    (d) =>
      auth.data.role === ROLE_ADMIN ||
      auth.data.sections.includes(d.key.toUpperCase()),
  );
  const sections: DemoSection[] = await Promise.all(
    allowed.map(async (d) => ({
      key: d.key,
      label: d.label,
      color: d.color,
      projects: await loadTree(d.key),
    })),
  );
  return NextResponse.json({ sections });
}