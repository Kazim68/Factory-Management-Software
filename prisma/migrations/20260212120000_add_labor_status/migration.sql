-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LaborProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentTypeId" TEXT NOT NULL,
    "defaultRate" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LaborProfile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LaborCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LaborProfile_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentCalculationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LaborProfile" ("categoryId", "createdAt", "defaultRate", "id", "name", "paymentTypeId", "updatedAt", "status")
SELECT "categoryId", "createdAt", "defaultRate", "id", "name", "paymentTypeId", "updatedAt", 'ACTIVE' FROM "LaborProfile";
DROP TABLE "LaborProfile";
ALTER TABLE "new_LaborProfile" RENAME TO "LaborProfile";
CREATE INDEX "LaborProfile_categoryId_idx" ON "LaborProfile"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
