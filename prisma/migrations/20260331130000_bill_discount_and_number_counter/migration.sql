DROP INDEX IF EXISTS "Bill_billNumber_key";

ALTER TABLE "BillLine" ADD COLUMN "discount" DECIMAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "bill_number_counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "bill_number_counter" ("id", "lastNumber", "updatedAt")
SELECT
    'default',
    COALESCE(MAX(CAST("billNumber" AS INTEGER)), 0),
    CURRENT_TIMESTAMP
FROM "Bill"
WHERE "billNumber" GLOB '[0-9][0-9][0-9][0-9]'
  AND CAST("billNumber" AS INTEGER) BETWEEN 0 AND 9999
ON CONFLICT("id") DO NOTHING;
