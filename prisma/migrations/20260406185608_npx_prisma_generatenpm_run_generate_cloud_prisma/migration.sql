-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductionOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "department" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "laborId" TEXT,
    "packingLaborId" TEXT,
    "quantityDozen" DECIMAL NOT NULL,
    "pricePerDozen" DECIMAL NOT NULL DEFAULT 0,
    "packingPricePerDozen" DECIMAL NOT NULL DEFAULT 0,
    "completedDozen" DECIMAL NOT NULL DEFAULT 0,
    "bMallDozen" DECIMAL NOT NULL DEFAULT 0,
    "cMallDozen" DECIMAL NOT NULL DEFAULT 0,
    "forwardedDozen" DECIMAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionOrder_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionOrder_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionOrder_packingLaborId_fkey" FOREIGN KEY ("packingLaborId") REFERENCES "LaborProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionOrder" ("articleId", "bMallDozen", "cMallDozen", "closedAt", "completedDozen", "createdAt", "department", "forwardedDozen", "id", "isClosed", "laborId", "packingLaborId", "packingPricePerDozen", "pricePerDozen", "quantityDozen", "size", "source", "stage", "updatedAt") SELECT "articleId", "bMallDozen", "cMallDozen", "closedAt", "completedDozen", "createdAt", "department", "forwardedDozen", "id", "isClosed", "laborId", "packingLaborId", "packingPricePerDozen", "pricePerDozen", "quantityDozen", "size", "source", "stage", "updatedAt" FROM "ProductionOrder";
DROP TABLE "ProductionOrder";
ALTER TABLE "new_ProductionOrder" RENAME TO "ProductionOrder";
CREATE INDEX "ProductionOrder_department_isClosed_updatedAt_idx" ON "ProductionOrder"("department", "isClosed", "updatedAt");
CREATE INDEX "ProductionOrder_articleId_department_idx" ON "ProductionOrder"("articleId", "department");
CREATE INDEX "ProductionOrder_packingLaborId_idx" ON "ProductionOrder"("packingLaborId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
