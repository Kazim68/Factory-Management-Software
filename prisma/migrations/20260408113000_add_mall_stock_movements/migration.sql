-- CreateTable
CREATE TABLE "MallStockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mallType" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUT',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityDozen" DECIMAL NOT NULL,
    "ratePerDozen" DECIMAL,
    "totalAmount" DECIMAL,
    "reference" TEXT,
    "note" TEXT,
    "roznamchaEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MallStockMovement_roznamchaEntryId_key" ON "MallStockMovement"("roznamchaEntryId");

-- CreateIndex
CREATE INDEX "MallStockMovement_mallType_date_idx" ON "MallStockMovement"("mallType", "date");
