-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "chequeNumber" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "sourcePartyId" TEXT,
    "usedPartyId" TEXT,
    "sourcePaymentId" TEXT,
    "usedPaymentId" TEXT,
    "cashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cheque_sourcePartyId_fkey" FOREIGN KEY ("sourcePartyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cheque_usedPartyId_fkey" FOREIGN KEY ("usedPartyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cheque_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "PartyPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cheque_usedPaymentId_fkey" FOREIGN KEY ("usedPaymentId") REFERENCES "PartyPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_sourcePaymentId_key" ON "Cheque"("sourcePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_usedPaymentId_key" ON "Cheque"("usedPaymentId");

-- CreateIndex
CREATE INDEX "Cheque_status_date_idx" ON "Cheque"("status", "date");

-- CreateIndex
CREATE INDEX "Cheque_amount_idx" ON "Cheque"("amount");
