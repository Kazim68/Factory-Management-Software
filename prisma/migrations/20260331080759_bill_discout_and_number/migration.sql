-- Ensure bill number counter table exists with the expected shape.
DROP TABLE IF EXISTS "bill_number_counter";

CREATE TABLE "bill_number_counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
