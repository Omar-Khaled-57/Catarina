// POST /api/upload — Upload a file (profile picture, etc.)
// Accepts image files: jpg, png, gif (animated), webp (animated)
// Converts to base64 data URI and returns it (no filesystem writes — Vercel-safe)
//
// The declared MIME type is not trusted — file signatures (magic bytes)
// are sniffed to confirm the actual content.

import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB (base64 adds ~33%)
const UPLOAD_WINDOW_MS = 60_000;
const UPLOAD_MAX_PER_WINDOW = 20;

/** Sniff the actual image format from magic bytes; returns MIME or null */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF: "GIF8" (87a or 89a)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(
    `upload:${getClientIp(req)}`,
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

    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError(
        "Unsupported file type. Use JPG, PNG, GIF, or WebP.",
        400
      );
    }

    if (file.size > MAX_SIZE) {
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
