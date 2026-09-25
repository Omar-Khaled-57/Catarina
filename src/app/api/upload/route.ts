// POST /api/upload — Upload a file (profile picture, etc.)
// Accepts image files: jpg, png, gif (animated), webp (animated)
// Converts to base64 data URI and returns it (no filesystem writes — Vercel-safe)
//
// The declared MIME type is not trusted — file signatures (magic bytes)
// are sniffed to confirm the actual content.

import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ipRateLimitKey } from "@/lib/rateLimitPolicy";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  sniffImageType,
} from "@/lib/image";

const UPLOAD_WINDOW_MS = 60_000;
const UPLOAD_MAX_PER_WINDOW = 20;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

    const limited = await checkRateLimit(
      ipRateLimitKey("upload", getClientIp(req)),
      UPLOAD_MAX_PER_WINDOW,
      UPLOAD_WINDOW_MS
    );
  if (limited.limited) {
    return jsonError("Too many uploads, try again shortly", 429);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return jsonError("No file provided", 400);
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return jsonError(
        "Unsupported file type. Use JPG, PNG, GIF, or WebP.",
        400
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return jsonError("File too large. Max 2 MB.", 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    /* Verify content matches a supported image format (ignore declared MIME) */
    const detected = sniffImageType(bytes);
    if (!detected) {
      return jsonError("File is not a valid image", 400);
    }

    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${detected};base64,${base64}`;

    return NextResponse.json({ url: dataUri });
  } catch (error) {
    console.error("[UPLOAD]", error);
    return jsonError("Upload failed", 500);
  }
}
