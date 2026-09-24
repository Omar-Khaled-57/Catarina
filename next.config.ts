import type { NextConfig } from "next";

/*
 * Global security headers. These are static (no per-request nonce) — a
 * pragmatic, low-breakage baseline that ships on every route without
 * depending on middleware. The strictest controls (per-request CSP nonce)
 * live where the payload is actually rendered; see src/proxy.ts.
 *
 * CSP notes:
 *  - script-src/needs 'unsafe-inline' for Next's inline RSC hydration payload.
 *  - No 'unsafe-eval' — attacker eval() is blocked.
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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

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
