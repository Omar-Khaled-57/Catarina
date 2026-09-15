-- CreateTable
CREATE TABLE "TeamTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#00E8A2',
    "cells" JSONB NOT NULL,
    "stickers" JSONB NOT NULL DEFAULT [],
    "isDateBased" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "envelopeId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "totalBytes" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_WorkspaceUpload" ("chunkCount", "chunkSize", "createdAt", "createdBy", "envelopeId", "id", "mime", "name", "projectId", "sectionKey", "totalBytes", "type") SELECT "chunkCount", "chunkSize", "createdAt", "createdBy", "envelopeId", "id", "mime", "name", "projectId", "sectionKey", "totalBytes", "type" FROM "WorkspaceUpload";
DROP TABLE "WorkspaceUpload";
ALTER TABLE "new_WorkspaceUpload" RENAME TO "WorkspaceUpload";
CREATE INDEX "WorkspaceUpload_createdAt_idx" ON "WorkspaceUpload"("createdAt");
CREATE INDEX "WorkspaceUpload_sectionKey_idx" ON "WorkspaceUpload"("sectionKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamTable_section_idx" ON "TeamTable"("section");

-- CreateIndex
CREATE INDEX "TeamTable_createdById_idx" ON "TeamTable"("createdById");

-- CreateIndex
CREATE INDEX "TeamTable_deletedAt_idx" ON "TeamTable"("deletedAt");
