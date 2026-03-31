-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bill_number_counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_bill_number_counter" ("id", "lastNumber", "updatedAt") SELECT "id", "lastNumber", "updatedAt" FROM "bill_number_counter";
DROP TABLE "bill_number_counter";
ALTER TABLE "new_bill_number_counter" RENAME TO "bill_number_counter";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
