# <img src="../public/rina/update.webp" width="80" align="center" /> Changelog

The complete release history lives in [`CHANGELOG.md`](../CHANGELOG.md) at the project root. The current version is `0.7.1` in [`package.json`](../package.json), with the footer chip in `src/components/Footer.tsx` matching it.

This page is an index only; it does not replace the detailed notes.

## Release history at a glance

| Version | Date in `CHANGELOG.md` | Theme |
| --- | --- | --- |
| `0.7.1` | 2026-09-25 (follow-up 2026-09-26) | Breach-Ready: rate-limit/CSRF fixes, rotating refresh tokens, table and drawer hardening |
| `0.7.0` | 2026-09-24 | Security hardening, security headers, Next.js 16.3.6 |
| `0.6.1` | 2026-09-24 | One-time login and show/hide password fields |
| `0.6.0` | 2026-09-15 | The Cabinet — Drawers and Team Tables |
| `0.4.5` | 2026-09-06 | Self-hosted rate limiting moves from Upstash to Turso |
| `0.4.4` | 2026-08-04 | API security, validation and reliability |
| `0.4.3` | 2026-07-28 | Self-hosting, dynamic branding, migration workflow |
| `0.4.2` | 2026-07-27 | Notification modal, goal deep-link highlighting |
| `0.4.1` | 2026-07-26 | PDF export and UI refinements |
| `0.4.0` | 2026-07-26 | Realtime sync and optimistic UI |
| `0.3.2` | 2026-07-25 | Component extraction and accessibility |
| `0.2.0` | 2026-07-24 | Profile system and Catarina expressions |
| `0.1.5` | 2026-07-23 | Stability and UX polish |
| `0.1.0` | 2026-07-23 | Initial release |

## In-app changelog

[`src/lib/changelog.json`](../src/lib/changelog.json) supplies the update modal and `GET /api/auth/me` update detection. A release must add a matching entry there or the modal falls back to a generic message. Its entries currently include `0.7.1` and `0.7.0` in addition to older releases; the ordering in the JSON file is not chronological.

## Known gaps

- `CHANGELOG.md` cites test counts at the release gate (194/194 for the initial 0.7.1 gate; 294/294 after the follow-up). The current run of `npm test` reports 294 tests in 39 suites; see [Testing](./testing.md).
- The changelog documents seven remaining Prisma CLI advisories and an accepted CSP `'unsafe-inline'` allowance; neither is resolved in code.

## Sources

[`CHANGELOG.md`](../CHANGELOG.md), [`src/lib/changelog.json`](../src/lib/changelog.json), [`package.json`](../package.json), [`src/components/Footer.tsx`](../src/components/Footer.tsx), [API Reference](./api-reference.md#auth).
