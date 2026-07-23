// Prisma Client Singleton
// Prevents multiple Prisma instances in development (hot-reload safe)
// Uses LibSQL adapter for Turso (required by Prisma 7)
// PrismaLibSql takes a config object {url, authToken} — NOT a pre-created client

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

/** Singleton Prisma client — use this everywhere instead of instantiating new PrismaClient */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
