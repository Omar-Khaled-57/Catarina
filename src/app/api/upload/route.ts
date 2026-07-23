// POST /api/upload — Upload a file (profile picture, etc.)
// Accepts image files: jpg, png, gif (animated), webp (animated)
// Saves to public/uploads/ and returns the public URL path

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth.server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    /* Validate file type */
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }

    /* Validate file size */
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5 MB." },
        { status: 400 }
      );
    }

    /* Generate unique filename preserving extension */
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${payload.userId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filepath = path.join(uploadDir, filename);

    /* Ensure upload directory exists */
    await mkdir(uploadDir, { recursive: true });

    /* Write file to disk */
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    return NextResponse.json({
      url: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error("[UPLOAD]", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
