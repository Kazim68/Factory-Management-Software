-- Add department display-name overrides.
CREATE TABLE "LaborDepartmentName" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "department" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "LaborDepartmentName_department_key" ON "LaborDepartmentName"("department");

-- Add line-item size to bills.
ALTER TABLE "BillLine" ADD COLUMN "size" TEXT;

-- Add direct stock entries for admin-managed stock adjustments.
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "quantityDozen" DECIMAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockEntry_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StockEntry_mode_articleId_idx" ON "StockEntry"("mode", "articleId");
