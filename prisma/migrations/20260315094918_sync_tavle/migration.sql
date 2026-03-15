/*
  Warnings:

  - You are about to alter the column `data` on the `change_log` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_change_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT NOT NULL
);
INSERT INTO "new_change_log" ("created_at", "data", "device_id", "entity", "entity_id", "id", "operation", "synced") SELECT "created_at", "data", "device_id", "entity", "entity_id", "id", "operation", "synced" FROM "change_log";
DROP TABLE "change_log";
ALTER TABLE "new_change_log" RENAME TO "change_log";
CREATE INDEX "change_log_synced_created_at_idx" ON "change_log"("synced", "created_at");
CREATE TABLE "new_sync_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "last_sync_timestamp" DATETIME,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_sync_state" ("id", "last_sync_timestamp", "updated_at") SELECT "id", "last_sync_timestamp", "updated_at" FROM "sync_state";
DROP TABLE "sync_state";
ALTER TABLE "new_sync_state" RENAME TO "sync_state";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
