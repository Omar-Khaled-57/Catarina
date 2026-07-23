// This file configures the Prisma CLI (migrate, studio, generate).
// The app runtime uses @libsql/client adapter in src/lib/prisma.ts pointing to Turso.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI tools use the local SQLite file
    url: "file:./dev.db",
  },
});
