/**
 * Same-origin verification for mutating requests — pure, no imports.
 *
 * WHY this exists separately from the edge proxy: the previous inline version
 * failed OPEN in two cases, and both are attacker-controlled.
 *
 *  1. `Origin: null` — the literal header value a sandboxed iframe, a data: URL
 *     document, and some privacy tooling send for an opaque origin. It is not a
 *     parseable URL, so it fell into the "malformed → allow" branch. A
 *     cross-origin page embedding a sandboxed iframe could therefore POST with
 *     the victim's session cookie attached and be allowed through.
 *  2. Any malformed Origin/Referer — also allowed, for the same reason.
 *
 * The rule is now: an origin that is PRESENT must be valid and must match.
 * Only a completely absent Origin/Referer is treated as a non-browser client
 * and allowed, which is safe because the session cookie is SameSite=Lax, so a
 * genuine cross-site browser request would not carry it in the first place.
 * Absence of a Host header is no longer trusted either: without it same-origin
 * cannot be established, so the request fails closed.
 *
 * Edge-runtime safe: uses only `URL` and string operations.
 */

export type OriginVerdict =
  /** The origin is present, valid, and matches the request host. */
  | "same-origin"
  /** A valid origin that points somewhere else. */
  | "foreign-origin"
  /** No Origin and no Referer: a non-browser client. Allowed. */
  | "absent"
  /** `Origin: null`, or an empty/garbage value that was explicitly sent. */
  | "opaque-or-malformed"
  /** No Host header, so same-origin cannot be established. */
  | "no-host";

export interface OriginInput {
  origin: string | null;
  referer: string | null;
  host: string | null;
}

/** Values a browser sends to mean "I have no usable origin". */
function isOpaque(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed.toLowerCase() === "null";
}

/**
 * Compare a parsed origin's host against the Host header, tolerating an
 * explicitly-sent default port (the URL parser elides it from `host`).
 */
function hostsMatch(origin: URL, requestHost: string): boolean {
  let host = requestHost.trim().toLowerCase();
  if (origin.protocol === "https:" && host.endsWith(":443")) {
    host = host.slice(0, -":443".length);
  }
  if (origin.protocol === "http:" && host.endsWith(":80")) {
    host = host.slice(0, -":80".length);
  }
  return origin.host.toLowerCase() === host;
}

/** Full verdict, including the reason — useful for tests and server logs. */
export function classifyOrigin({
  origin,
  referer,
  host,
}: OriginInput): OriginVerdict {
  const claimed = origin ?? referer;

  /* Origin takes precedence when both are present. */
  if (claimed === null) return "absent";
  if (isOpaque(claimed)) return "opaque-or-malformed";

  let parsed: URL;
  try {
    parsed = new URL(claimed);
  } catch {
    return "opaque-or-malformed";
  }

  /* Only http(s) can legitimately carry a browser Origin. */
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "opaque-or-malformed";
  }

  if (host === null || host.trim() === "") return "no-host";
  return hostsMatch(parsed, host) ? "same-origin" : "foreign-origin";
}

/**
 * True when a mutating request may proceed.
 *
 * Deliberately strict about anything the client actually sent, and permissive
 * only about total absence of Origin/Referer.
 */
export function isSameOrigin(input: OriginInput): boolean {
  const verdict = classifyOrigin(input);
  return verdict === "same-origin" || verdict === "absent";
}
