ALTER TABLE "LaborProfile" ADD COLUMN "phone" TEXT;

ALTER TABLE "LaborProfile" ADD COLUMN "city" TEXT;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_LaborProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'PRESSMAN',
    "phone" TEXT,
    "city" TEXT,
    "defaultRate" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_LaborProfile" (
    "id",
    "name",
    "department",
    "phone",
    "city",
    "defaultRate",
    "status",
    "deletedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "department",
    "phone",
    "city",
    "defaultRate",
    "status",
    NULL,
    "createdAt",
    "updatedAt"
FROM "LaborProfile";

DROP TABLE "LaborProfile";

ALTER TABLE "new_LaborProfile" RENAME TO "LaborProfile";

CREATE INDEX "LaborProfile_department_idx" ON "LaborProfile"("department");

DROP TABLE IF EXISTS "PaymentCalculationType";

PRAGMA foreign_keys=ON;
