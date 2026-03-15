-- Sync metadata tables for offline-first replication
CREATE TABLE IF NOT EXISTS "change_log" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "data" JSON NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "synced" BOOLEAN NOT NULL DEFAULT false,
  "device_id" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "change_log_synced_created_at_idx"
ON "change_log"("synced", "created_at");

CREATE TABLE IF NOT EXISTS "sync_state" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "last_sync_timestamp" DATETIME,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
