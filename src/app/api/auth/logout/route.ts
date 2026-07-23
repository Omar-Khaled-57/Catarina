// POST /api/auth/logout — Clear the authentication cookie

import { NextResponse } from "next/server";
import { removeToken } from "@/lib/auth.server";

export async function POST() {
  await removeToken();
  return NextResponse.json({ success: true });
}
