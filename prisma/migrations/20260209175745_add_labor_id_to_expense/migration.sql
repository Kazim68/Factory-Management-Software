-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExpenseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "categoryId" TEXT NOT NULL,
    "partyId" TEXT,
    "laborId" TEXT,
    "module" TEXT NOT NULL DEFAULT 'MISC',
    "amount" DECIMAL NOT NULL,
    "description" TEXT,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "laborAdvanceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_laborAdvanceId_fkey" FOREIGN KEY ("laborAdvanceId") REFERENCES "LaborAdvance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseEntry" ("amount", "categoryId", "chemicalPurchaseId", "createdAt", "date", "description", "id", "laborAdvanceId", "materialPurchaseId", "module", "partyId", "rexinePurchaseId") SELECT "amount", "categoryId", "chemicalPurchaseId", "createdAt", "date", "description", "id", "laborAdvanceId", "materialPurchaseId", "module", "partyId", "rexinePurchaseId" FROM "ExpenseEntry";
DROP TABLE "ExpenseEntry";
ALTER TABLE "new_ExpenseEntry" RENAME TO "ExpenseEntry";
CREATE INDEX "ExpenseEntry_date_idx" ON "ExpenseEntry"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
