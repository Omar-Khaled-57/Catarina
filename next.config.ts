import type { NextConfig } from "next";

/*
 * Global security headers. The production CSP remains strict; development adds
 * eval only for React's source-map diagnostics.
 *
 * CSP notes:
 *  - script-src/needs 'unsafe-inline' for Next's inline RSC hydration payload.
 *    This is a real, accepted weakening: a per-request nonce would remove it,
 *    but that requires plumbing a nonce from the edge proxy through App Router
 *    rendering, which is not implemented here. Until it is, treat the CSP as
 *    defence in depth only — it blocks remote and eval'd script sources, NOT
 *    injected inline script. The primary control against stored XSS is the
 *    server-side byte sniffing in /api/drawers/files/[id], which decides
 *    inline vs. download and never trusts a client-declared MIME type.
 *  - No 'unsafe-eval' in production. Next/React development diagnostics need
 *    it to reconstruct component stacks, so it is added only outside prod.
 *  - No remote origins — only scripts/styles/images served by Catarina itself,
 *    so a stolen API key or a compromised CDN can't be a script source.
 *  - 'self' covers data: for user-uploaded images (cached under /pfps /rina).
 */

const SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

function contentSecurityPolicy(isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/* HSTS is emission-only in production; local `next dev` over http must stay
 * usable. max-age 6 months with includeSubDomains + preload. */
const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=15778800; includeSubDomains; preload",
};

const nextConfig: NextConfig = {
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: contentSecurityPolicy(isProd) },
          ...(isProd ? [HSTS_HEADER] : []),
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/rina/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/pfps/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
