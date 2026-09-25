-- Refresh-token rotation: single-use exchange, family grouping, absolute expiry.
--
-- Each legacy row becomes the root of its own family (familyId = id) so no two
-- pre-existing tokens can ever be mistaken for a rotation pair. expiresAt is
-- backfilled to now + 30 days (the family ceiling) rather than left at
-- CURRENT_TIMESTAMP, which would have expired every "remember me" device the
-- instant this migration ran.
ALTER TABLE "RefreshToken" ADD COLUMN "familyId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "usedAt" DATETIME;
ALTER TABLE "RefreshToken" ADD COLUMN "expiresAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
UPDATE "RefreshToken" SET "expiresAt" = datetime('now', '+30 days') WHERE "expiresAt" IS NULL;

CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
