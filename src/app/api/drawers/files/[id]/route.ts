// GET /api/drawers/files/[id] — stream one assembled workspace file as raw
// bytes so the client can build an object URL (preview/download). Only
// authenticated users can read; large blobs are served as a streamed body so
// they don't count against the 4.5MB response cap of JSON payloads.

import { NextRequest } from "next/server";
import { requireUser, canAccessSection, jsonError } from "@/lib/api-helpers";
import { getFile, getUploadStore, normalizeFileId } from "@/lib/workspaceFiles";
import { sniffImageType } from "@/lib/image";

/* Files are re-served so the client can preview them — but the *browser* also
 * re-serves them, and the stored `mime` is client-supplied and unsniffed.
 * Serving an HTML/SVG blob inline at the app origin would render it as a
 * document under our script-src 'unsafe-inline' CSP, turning a stored drawer
 * file into stored XSS. Root-cause policy: the server never decides whether a
 * stored blob becomes a *document* by trusting the declared mime — it stays
 * inline ONLY when the actual bytes sniff to a known-safe non-executable media
 * type; anything else is served as a download (attachment). The client builds
 * object URLs from a Blob over fetch, so download disposition doesn't break
 * previews — it only stops the browser treating the re-served bytes as HTML. */
const SAFE_INLINE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "application/pdf", /* PDFs render in the viewer, not as a scriptable doc. */
]);

/** True when a stored blob is safe to show inline at the app origin. Bytes are
 *  re-sniffed here (not the stored mime trusted) so a forged `text/html`——
 *  or a real image MIME carrying scriptable bytes—is never sent inline. */
function isSafeInline(file: { mime: string; data: Uint8Array }): boolean {
  if (!SAFE_INLINE_MIME.has(file.mime)) return false;
  const sniffed = sniffImageType(file.data);
  if (sniffed) return sniffed === file.mime; /* Image: bytes must match mime. */
  /* Non-image media has no sniff helper yet — round-trip it as a download to
     stay fail-closed rather than trust a client-declared video/audio/pdf. */
  return false;
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const normalized = normalizeFileId(id);
  if (!normalized) return jsonError("Invalid file id", 400);

  const client = getUploadStore();
  if (!client) return jsonError("Drawer storage is unavailable", 503);

  const file = await getFile(client, normalized);
  if (!file) return jsonError("File not found", 404);

  /* Non-members are not told the file exists — return 404 instead of 403
     so the response is the same as a missing id. */
  if (!(await canAccessSection(auth.data.userId, file.sectionKey))) {
    return jsonError("File not found", 404);
  }

  /* Sink decision — serve inline ONLY for bytes that sniff to a known-safe
   * non-executable media type (server re-sniffs; the stored mime is never
   * trusted). Anything else — including stored HTML/SVG/XML or scriptable
   * bytes declared as an image — is served as a forced download, so the
   * browser never renders drawer bytes as a document at the app origin. */
  const inline = isSafeInline(file);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": inline ? file.mime : "application/octet-stream",
      /* Filename is deliberately NOT echoed here — the stored name is
         client-supplied and could inject CRLF/newlines (header injection) via
         Content-Disposition. A fixed generic name removes that whole vector;
         previews still work because the client builds an object URL from a
         Blob over fetch, so the generic download name never touches the UI. */
      "Content-Disposition": inline ? "inline" : 'attachment; filename="drawer-file.bin"',
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}