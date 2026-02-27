/*
  Warnings:

  - You are about to drop the column `categoryId` on the `ExpenseEntry` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExpenseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "partyId" TEXT,
    "laborId" TEXT,
    "module" TEXT NOT NULL DEFAULT 'MISC',
    "paymentType" TEXT NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL NOT NULL,
    "description" TEXT,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "laborAdvanceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceSystem" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_laborAdvanceId_fkey" FOREIGN KEY ("laborAdvanceId") REFERENCES "LaborAdvance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseEntry" ("amount", "chemicalPurchaseId", "createdAt", "date", "description", "id", "laborAdvanceId", "laborId", "materialPurchaseId", "module", "partyId", "paymentType", "rexinePurchaseId", "source", "sourceSystem") SELECT "amount", "chemicalPurchaseId", "createdAt", "date", "description", "id", "laborAdvanceId", "laborId", "materialPurchaseId", "module", "partyId", "paymentType", "rexinePurchaseId", "source", "sourceSystem" FROM "ExpenseEntry";
DROP TABLE "ExpenseEntry";
ALTER TABLE "new_ExpenseEntry" RENAME TO "ExpenseEntry";
CREATE INDEX "ExpenseEntry_date_idx" ON "ExpenseEntry"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
