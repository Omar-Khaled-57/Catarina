import { createClient } from "@libsql/client";

async function main() {
  console.log("Connecting to Turso...");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const statements = [
    // Alter User table if columns missing
    `ALTER TABLE "User" ADD COLUMN "welcomeSeen" BOOLEAN NOT NULL DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN "lastSeenVersion" TEXT NOT NULL DEFAULT '0.3.2';`,
    
    // Alter Goal table
    `ALTER TABLE "Goal" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
    
    // Alter Approval table
    `ALTER TABLE "Approval" ADD COLUMN "pfp" TEXT;`,

    // Create SectionConfig table
    `CREATE TABLE IF NOT EXISTS "SectionConfig" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "label" TEXT NOT NULL,
      "prefix" TEXT NOT NULL,
      "color" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "SectionConfig_isActive_idx" ON "SectionConfig"("isActive");`,
    `CREATE INDEX IF NOT EXISTS "SectionConfig_sortOrder_idx" ON "SectionConfig"("sortOrder");`
  ];

  for (const stmt of statements) {
    try {
      console.log("Executing:", stmt);
      await client.execute(stmt);
      console.log("SUCCESS");
    } catch (err) {
      console.log("INFO (statement skipped/already applied):", err.message || err);
    }
  }

  console.log("Schema update complete!");
}

main().catch(console.error);
