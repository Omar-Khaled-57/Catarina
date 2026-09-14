-- CreateTable
CREATE TABLE "WorkspaceUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateTable
CREATE TABLE "WorkspaceUploadChunk" (
    "uploadId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "data" BLOB NOT NULL,

    PRIMARY KEY ("uploadId", "chunkIndex")
);

-- CreateTable
CREATE TABLE "WorkspaceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "envelopeId" TEXT,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "WorkspaceUpload_createdAt_idx" ON "WorkspaceUpload"("createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceFile_createdAt_idx" ON "WorkspaceFile"("createdAt");
