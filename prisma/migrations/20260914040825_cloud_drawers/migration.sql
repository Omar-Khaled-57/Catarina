/*
  Warnings:

  - You are about to drop the `DriveConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rate_limit_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DriveConnection";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "rate_limit_events";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "DrawerSection" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "tree" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RateLimitEvent_key_ts_idx" ON "RateLimitEvent"("key", "ts");

-- CreateIndex
CREATE INDEX "RateLimitEvent_ts_idx" ON "RateLimitEvent"("ts");
