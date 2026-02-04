/*
  Warnings:

  - You are about to drop the column `expenseEntryId` on the `LaborAdvance` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LaborAdvance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "laborId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaborAdvance_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LaborAdvance" ("amount", "createdAt", "date", "id", "laborId", "reason") SELECT "amount", "createdAt", "date", "id", "laborId", "reason" FROM "LaborAdvance";
DROP TABLE "LaborAdvance";
ALTER TABLE "new_LaborAdvance" RENAME TO "LaborAdvance";
CREATE INDEX "LaborAdvance_laborId_date_idx" ON "LaborAdvance"("laborId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
