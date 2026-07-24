// GET /api/sections — List active sections (public, any auth user)

import { NextResponse } from "next/server";
import { getSections } from "@/lib/sections";

export async function GET() {
  const sections = await getSections();
  return NextResponse.json({ sections });
}
