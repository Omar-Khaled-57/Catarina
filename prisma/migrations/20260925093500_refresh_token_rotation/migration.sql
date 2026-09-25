-- Refresh-token rotation: single-use exchange, family grouping, absolute expiry.
--
-- Each legacy row becomes the root of its own family (familyId = id) so no two
-- pre-existing tokens can ever be mistaken for a rotation pair. expiresAt is
-- backfilled to now + 30 days (the family ceiling) rather than left at
-- CURRENT_TIMESTAMP, which would have expired every "remember me" device the
-- instant this migration ran.
--
-- "expiresAt" is added as a NULLABLE column with no DEFAULT on purpose. SQLite
-- refuses `ADD COLUMN ... NOT NULL DEFAULT CURRENT_TIMESTAMP` on a table that
-- already has rows ("Cannot add a column with non-constant default"), and in
-- production this table is never empty — there are live refresh tokens on real
-- devices. The backfill below is what makes the column meaningful, so the
-- database-level NOT NULL is traded for a migration that actually applies.
-- Every write path sets expiresAt explicitly (see nextExpiry in refreshPolicy),
-- so no row can be left unset after the backfill.
ALTER TABLE "RefreshToken" ADD COLUMN "familyId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "usedAt" DATETIME;
ALTER TABLE "RefreshToken" ADD COLUMN "expiresAt" DATETIME;

UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
UPDATE "RefreshToken" SET "expiresAt" = datetime('now', '+30 days') WHERE "expiresAt" IS NULL;

CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
