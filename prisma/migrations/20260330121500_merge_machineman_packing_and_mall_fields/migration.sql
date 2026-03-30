-- Add merged Machineman + Packing fields on production orders
ALTER TABLE "ProductionOrder" ADD COLUMN "packingLaborId" TEXT;
ALTER TABLE "ProductionOrder" ADD COLUMN "packingPricePerDozen" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductionOrder" ADD COLUMN "bMallDozen" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductionOrder" ADD COLUMN "cMallDozen" DECIMAL NOT NULL DEFAULT 0;

-- Keep SQLite migration simple; relation is managed at Prisma layer.
CREATE INDEX "ProductionOrder_packingLaborId_idx" ON "ProductionOrder"("packingLaborId");
