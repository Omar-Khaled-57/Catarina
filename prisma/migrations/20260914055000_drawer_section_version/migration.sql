-- AlterTable: optimistic-locking counter for whole-tree writes. Two teammates
-- mutating the same section concurrently used to last-write-wins (silent loss).
-- Writers now compare-and-swap on this column: a stale writer matches 0 rows
-- and gets a 409 (see src/lib/drawers.ts). Seed 0; the first writer to a
-- pre-existing row bumps it to 1.
ALTER TABLE "DrawerSection" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;