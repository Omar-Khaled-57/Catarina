-- AlterTable: upload sessions belong to exactly one section — the runtime SQL
-- (src/lib/workspaceFiles.ts) has always inserted and selected this column, but
-- the scaffolded `20260914044910_workspace_uploads` migration omitted it, so a
-- table created from that migration rejects every chunked upload on INSERT and
-- fails the cross-section guards on saveChunk/commitUpload.
-- New sessions always carry a real key; rows from before (incomplete sessions)
-- get '' and are swept by the 1h TTL.
ALTER TABLE "WorkspaceUpload" ADD COLUMN "sectionKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "WorkspaceUpload_sectionKey_idx" ON "WorkspaceUpload"("sectionKey");

-- CreateIndex
-- deleteOrphanedFiles() scans WorkspaceFile by sectionKey on every destructive
-- mutation — give it an index instead of a full table scan.
CREATE INDEX "WorkspaceFile_sectionKey_idx" ON "WorkspaceFile"("sectionKey");