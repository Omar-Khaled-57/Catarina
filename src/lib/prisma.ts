// Prisma Client Singleton
// Prevents multiple Prisma instances in development (hot-reload safe)
// Uses the LibSQL adapter for Turso, or DEV_DATABASE_URL during local development
// PrismaLibSql takes a config object {url, authToken} — NOT a pre-created client

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const localDevUrl =
    process.env.NODE_ENV !== "production" ? process.env.DEV_DATABASE_URL : undefined;
  const url = localDevUrl || process.env.DATABASE_URL;
  if (!url) {
    /* Fail fast with an actionable message instead of a confusing adapter crash. */
    throw new Error(
      "DATABASE_URL is not set. Add it to your environment (.env / .env.local) — e.g. a Turso libsql:// connection string or a local sqlite:// file."
    );
  }
  const adapter = new PrismaLibSql({
    url,
    authToken: localDevUrl ? undefined : process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

/** Singleton Prisma client — use this everywhere instead of instantiating new PrismaClient */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
