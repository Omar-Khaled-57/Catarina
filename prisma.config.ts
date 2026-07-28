// This file configures the Prisma CLI (migrate, studio, generate).
// The app runtime uses @libsql/client adapter in src/lib/prisma.ts pointing to Turso.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // On Vercel / CI: uses DATABASE_URL env var (Turso).
    // Locally: falls back to file:./dev.db for convenience.
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});
