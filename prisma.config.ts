// This file configures the Prisma CLI (migrate, studio, generate).
// The app runtime uses @libsql/client adapter in src/lib/prisma.ts pointing to Turso.
//
// IMPORTANT: Prisma CLI does NOT support libsql:// URLs.
// CLI tools always use the local SQLite file. Migrations are applied to
// Turso separately via `turso db execute` or `turso-push.mjs`.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "file:./dev.db",
  },
});
