-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);

-- CreateIndex
CREATE INDEX "rate_limit_events_key_ts_idx" ON "rate_limit_events"("key", "ts");

-- CreateIndex
CREATE INDEX "rate_limit_events_ts_idx" ON "rate_limit_events"("ts");