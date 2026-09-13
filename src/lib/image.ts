/**
 * Shared image validation for uploads.
 * The declared MIME type is never trusted — magic bytes are sniffed to confirm
 * the actual content, and SGV/svg-free MIME allowlist keeps data-URI avatars
 * from being abused as stored XSS (no SVG in the allowlist).
 */

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

/** Sniff the actual image format from magic bytes; returns MIME or null */
export function sniffImageType(bytes: Uint8Array): string | null {
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
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
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

const DATA_URI_RE =
  /^data:(image\/jpeg|image\/png|image\/gif|image\/webp);base64,([A-Za-z0-9+/=]+)$/;

/** Validate a base64 image data URI: allowed MIME, decodable, size-bounded. */
export function validateImageDataUri(value: string): boolean {
  const match = DATA_URI_RE.exec(value);
  if (!match) return false;
  try {
    const decoded = Buffer.from(match[2], "base64");
    if (decoded.length === 0 || !sniffImageType(decoded)) return false;
    return decoded.length <= MAX_IMAGE_SIZE;
  } catch {
    return false;
  }
}