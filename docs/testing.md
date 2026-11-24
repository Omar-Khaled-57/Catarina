# <img src="../public/rina/bug-fix.webp" width="80" align="center" /> Testing

## Runner and commands

The only test runner configured in [`package.json`](../package.json) is Node's built-in test runner with `tsx` as the TypeScript loader:

```bash
npm test          # node --import tsx --test "src/**/*.test.ts"
npm run lint      # eslint
npm run build     # next build (type-checked by Next)
```

There is no `typecheck` script; `next build` type-checks the project. The observed `npm test` output is **294 tests across 39 suites, all passing** (run in this working tree; no coverage threshold is configured). No coverage report is committed, and no CI workflow is present.

## What exists

All test files are colocated with the code they exercise, under `src/`:

| Area | Test files |
| --- | --- |
| Security policies | `src/lib/rateLimit.test.ts`, `rateLimitPolicy.test.ts`, `loginPolicy.test.ts`, `loginAttempt.test.ts`, `originGuard.test.ts`, `passwordPolicy.test.ts`, `registrationPolicy.test.ts`, `publicSection.test.ts`, `refreshPolicy.test.ts`, `databaseError.test.ts` |
| Domain helpers | `src/lib/mergeGoals.test.ts`, `permissions.test.ts`, `utils.test.ts`, `workspaceFiles.test.ts` |
| Team Tables (`src/lib/table/`) | `grid.test.ts`, `date.test.ts`, `pdf.test.ts`, `table-permissions.test.ts`, `tablePayload.test.ts`, `persistTable.test.ts` |

Notable behaviors asserted by those files, per the test names and [Developer Guide](./developer-guide.md#testing): sliding-window boundaries and sweep retention, trusted-IP and HMAC account keys, the ten-failure login cutoff and gate-before-bcrypt ordering, `Origin: null` CSRF classification, password length/byte caps and blocklist, registration conflict handling, refresh rotation and family ceiling, transient-database-error classification, delta merging, and grid merge/split/resize, date-axis detection, PDF escaping and compare-and-swap persistence.

## What is not covered

- There are no end-to-end, browser, or HTTP-integration test files in the repo; route handlers are exercised indirectly through their pure helper modules.
- No coverage report or threshold is committed (`coverage/` is gitignored).
- `prisma/seed.ts`, `prisma/seed-tables.ts`, and the gitignored `dev/` helpers are not part of the test command.
- The PWA service worker (`public/sw.js`) and generated Prisma client have no test files.

## Local data helpers (not tests)

`dev/seed-tables.mjs`, `dev/seed-month.mjs`, and `dev/SCHEMA-UPDATE-GUIDE.md` are gitignored local aids. `node dev/seed-month.mjs --dry-run` previews additive demo content; without `--dry-run` it writes to the database selected by `.env`. They are not run by `npm test` or shipped with the app; see [Data Model](./data-model.md#additive-newest-month-demo-seed-local-helper).

## Sources

[`package.json`](../package.json), the `src/**/*.test.ts` files listed above, [`README.md`](../README.md), [CHANGELOG.md](../CHANGELOG.md), [Developer Guide](./developer-guide.md#testing), [Data Model](./data-model.md#additive-newest-month-demo-seed-local-helper).
