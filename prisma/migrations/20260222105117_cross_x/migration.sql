/*
  Warnings:

  - You are about to drop the column `credit` on the `PartyLedgerEntry` table. All the data in the column will be lost.
  - You are about to drop the column `debit` on the `PartyLedgerEntry` table. All the data in the column will be lost.
  - You are about to drop the column `runningBalance` on the `PartyLedgerEntry` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PartyLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyLedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartyLedgerEntry_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartyLedgerEntry_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartyLedgerEntry_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PartyLedgerEntry" ("chemicalPurchaseId", "createdAt", "date", "description", "id", "materialPurchaseId", "partyId", "reference", "rexinePurchaseId") SELECT "chemicalPurchaseId", "createdAt", "date", "description", "id", "materialPurchaseId", "partyId", "reference", "rexinePurchaseId" FROM "PartyLedgerEntry";
DROP TABLE "PartyLedgerEntry";
ALTER TABLE "new_PartyLedgerEntry" RENAME TO "PartyLedgerEntry";
CREATE INDEX "PartyLedgerEntry_partyId_date_idx" ON "PartyLedgerEntry"("partyId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
