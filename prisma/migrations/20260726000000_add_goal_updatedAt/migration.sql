-- AlterTable: Add createdAt and updatedAt to Goal table for change detection
ALTER TABLE "Goal" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Goal" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
