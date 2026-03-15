-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('CASH', 'CREDIT');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT', 'BANK');

-- CreateEnum
CREATE TYPE "ExpenseModule" AS ENUM ('CHEMICAL', 'REXINE', 'MATERIAL', 'LABOR', 'MISC');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LaborStatus" AS ENUM ('ACTIVE', 'FIRED');

-- CreateEnum
CREATE TYPE "LaborDepartment" AS ENUM ('PRESSMAN', 'UPPERMAN', 'PRINTING', 'DC', 'MACHINEMAN', 'PACKING');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('STAGE_PRESSMAN', 'STAGE_UPPERMAN', 'STAGE_PRINTING', 'STAGE_DC', 'STAGE_MACHINEMAN', 'STAGE_PACKING');

-- CreateEnum
CREATE TYPE "ProductionOrderSource" AS ENUM ('MANUAL', 'PRESSMAN_FLOW', 'UPPER_PRINT_PARALLEL', 'STAGE_FLOW');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCalculationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCalculationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyLedgerEntry" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "billId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "laborId" TEXT,
    "module" "ExpenseModule" NOT NULL DEFAULT 'MISC',
    "paymentType" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "laborAdvanceId" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" "LaborDepartment" NOT NULL DEFAULT 'PRESSMAN',
    "paymentTypeId" TEXT NOT NULL,
    "defaultRate" DECIMAL(65,30),
    "status" "LaborStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "id" TEXT NOT NULL,
    "laborId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "unitId" TEXT,
    "rate" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborWorkEntry" (
    "id" TEXT NOT NULL,
    "laborId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "unitId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborWorkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborAdvance" (
    "id" TEXT NOT NULL,
    "laborId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "type" "BillType" NOT NULL DEFAULT 'CASH',
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(65,30) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChemicalPurchase" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "quantityKg" DECIMAL(65,30) NOT NULL,
    "ratePerKg" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paymentType" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChemicalPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexinePurchase" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "quantityMeter" DECIMAL(65,30) NOT NULL,
    "ratePerMeter" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paymentType" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RexinePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPurchase" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "articleId" TEXT,
    "unitId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "pricePerUnit" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paymentType" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyPayment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "description" TEXT,
    "billId" TEXT,
    "chemicalPurchaseId" TEXT,
    "rexinePurchaseId" TEXT,
    "materialPurchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "department" "LaborDepartment" NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "articleId" TEXT NOT NULL,
    "laborId" TEXT,
    "quantityDozen" DECIMAL(65,30) NOT NULL,
    "pricePerDozen" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "completedDozen" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "forwardedDozen" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "source" "ProductionOrderSource" NOT NULL DEFAULT 'MANUAL',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT NOT NULL,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" TEXT NOT NULL,
    "last_sync_timestamp" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Article_name_key" ON "Article"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCalculationType_name_key" ON "PaymentCalculationType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Party_name_key" ON "Party"("name");

-- CreateIndex
CREATE INDEX "PartyLedgerEntry_partyId_date_idx" ON "PartyLedgerEntry"("partyId", "date");

-- CreateIndex
CREATE INDEX "ExpenseEntry_date_idx" ON "ExpenseEntry"("date");

-- CreateIndex
CREATE INDEX "LaborProfile_department_idx" ON "LaborProfile"("department");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRate_laborId_articleId_unitId_key" ON "LaborRate"("laborId", "articleId", "unitId");

-- CreateIndex
CREATE INDEX "LaborWorkEntry_laborId_startDate_endDate_idx" ON "LaborWorkEntry"("laborId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LaborAdvance_laborId_date_idx" ON "LaborAdvance"("laborId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_date_idx" ON "Bill"("date");

-- CreateIndex
CREATE INDEX "ChemicalPurchase_date_idx" ON "ChemicalPurchase"("date");

-- CreateIndex
CREATE INDEX "RexinePurchase_date_idx" ON "RexinePurchase"("date");

-- CreateIndex
CREATE INDEX "MaterialPurchase_date_idx" ON "MaterialPurchase"("date");

-- CreateIndex
CREATE INDEX "PartyPayment_partyId_date_idx" ON "PartyPayment"("partyId", "date");

-- CreateIndex
CREATE INDEX "ProductionOrder_department_isClosed_updatedAt_idx" ON "ProductionOrder"("department", "isClosed", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionOrder_articleId_department_idx" ON "ProductionOrder"("articleId", "department");

-- CreateIndex
CREATE INDEX "change_log_synced_created_at_idx" ON "change_log"("synced", "created_at");

-- AddForeignKey
ALTER TABLE "PaymentCalculationType" ADD CONSTRAINT "PaymentCalculationType_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_laborAdvanceId_fkey" FOREIGN KEY ("laborAdvanceId") REFERENCES "LaborAdvance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborProfile" ADD CONSTRAINT "LaborProfile_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentCalculationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborWorkEntry" ADD CONSTRAINT "LaborWorkEntry_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborWorkEntry" ADD CONSTRAINT "LaborWorkEntry_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborWorkEntry" ADD CONSTRAINT "LaborWorkEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborAdvance" ADD CONSTRAINT "LaborAdvance_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChemicalPurchase" ADD CONSTRAINT "ChemicalPurchase_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexinePurchase" ADD CONSTRAINT "RexinePurchase_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_chemicalPurchaseId_fkey" FOREIGN KEY ("chemicalPurchaseId") REFERENCES "ChemicalPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_rexinePurchaseId_fkey" FOREIGN KEY ("rexinePurchaseId") REFERENCES "RexinePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPayment" ADD CONSTRAINT "PartyPayment_materialPurchaseId_fkey" FOREIGN KEY ("materialPurchaseId") REFERENCES "MaterialPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "LaborProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

