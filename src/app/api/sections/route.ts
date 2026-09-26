// GET /api/sections — PUBLIC list of active sections, for the registration form.
//
// This endpoint is intentionally unauthenticated: the registration form lives on
// the login page, where there is no session yet, and it needs the section list
// to render its dropdown. It therefore returns ONLY the display fields the form
// uses (key, label, color, prefix) and omits internal metadata (id, sortOrder,
// isActive) — see @/lib/publicSection. Admins who need the full set (including
// inactive sections) use the authenticated /api/admin/sections instead.

import { NextResponse } from "next/server";
import { getSections } from "@/lib/sections";
import { toPublicSections } from "@/lib/publicSection";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ipRateLimitKey, scaleForSharedBucket } from "@/lib/rateLimitPolicy";

/* Public and unauthenticated, so it is the cheapest endpoint in the app to
   hammer. The payload is tiny and cached for 30s server-side, but the request
   still costs a connection, so bound it per IP. */
const PUBLIC_SECTIONS_MAX_PER_WINDOW = 30;
const PUBLIC_SECTIONS_WINDOW_MS = 60_000;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limited = await checkRateLimit(
    ipRateLimitKey("sections", ip),
    scaleForSharedBucket(PUBLIC_SECTIONS_MAX_PER_WINDOW, ip),
    PUBLIC_SECTIONS_WINDOW_MS,
  );
  if (limited.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  const sections = await getSections();
  return NextResponse.json({ sections: toPublicSections(sections) });
}
