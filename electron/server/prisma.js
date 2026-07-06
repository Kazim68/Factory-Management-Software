import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { app } from "electron";
import { PrismaClient } from "../../database/generated/local-client/index.js";
import { withChangeLogging } from "./sync/changeLogger.js";
import { ensureSyncTables, getDeviceId } from "./sync/syncService.js";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_TABLES = ["Bill", "BillLine", "Party"];

const getPackagedDatabasePath = () =>
  path.join(app.getPath("userData"), "factory.db");

const getTemplateDatabasePath = () => {
  if (app?.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "database",
      "generated",
      "local-template",
      "factory-template.db",
    );
  }

  return path.resolve(
    __dirname,
    "../../database/generated/local-template/factory-template.db",
  );
};

const hasCoreSchema = (dbPath) => {
  if (!fs.existsSync(dbPath)) return false;

  const stats = fs.statSync(dbPath);
  if (!stats.size) return false;

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const statement = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    );

    return CORE_TABLES.every((tableName) => Boolean(statement.get(tableName)));
  } catch {
    return false;
  } finally {
    db?.close();
  }
};

const ensurePackagedDatabase = () => {
  if (!app?.isPackaged) return;

  const dbPath = getPackagedDatabasePath();
  if (hasCoreSchema(dbPath)) return;

  const templatePath = getTemplateDatabasePath();
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing packaged database template at ${templatePath}`);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${dbPath}.${timestamp}.bak`;
    fs.copyFileSync(dbPath, backupPath);
  }

  fs.copyFileSync(templatePath, dbPath);
};

const resolveDatabaseUrl = () => {
  if (app?.isPackaged) {
    const dbPath = getPackagedDatabasePath();
    return `file:${dbPath}`;
  }

  const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
  return `file:${dbPath}`;
};

const basePrisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
});

const BILL_COUNTER_ID = "default";
const SOFT_DELETE_TABLES = [
  "Unit",
  "Article",
  "Party",
  "PartyLedgerEntry",
  "ExpenseEntry",
  "LaborProfile",
  "LaborWorkEntry",
  "LaborAdvance",
  "Bill",
  "BillLine",
  "StockEntry",
  "MallStockMovement",
  "ChemicalPurchase",
  "RexinePurchase",
  "MaterialPurchase",
  "ProductionOrder",
];

const getMaxStoredBillNumber = async (prisma) => {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(MAX(CAST("billNumber" AS INTEGER)), 0) AS lastNumber
    FROM "Bill"
    WHERE "billNumber" GLOB '[0-9][0-9][0-9][0-9]'
      AND CAST("billNumber" AS INTEGER) BETWEEN 0 AND 9999
  `);

  return Number(row?.lastNumber ?? 0);
};

const ensureBillSchema = async (prisma) => {
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "Bill_billNumber_key"`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bill_number_counter (
      id TEXT PRIMARY KEY,
      lastNumber INTEGER NOT NULL DEFAULT 0,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const billLineColumns = await prisma.$queryRawUnsafe(
    `PRAGMA table_info("BillLine")`
  );

  if (!billLineColumns.some((column) => column.name === "discount")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "BillLine" ADD COLUMN "discount" DECIMAL NOT NULL DEFAULT 0`
    );
  }

  const existingCounter = await prisma.$queryRawUnsafe(
    `SELECT "id", "lastNumber" FROM bill_number_counter WHERE "id" = ? LIMIT 1`,
    BILL_COUNTER_ID
  );
  const maxStoredBillNumber = await getMaxStoredBillNumber(prisma);

  if (existingCounter.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO bill_number_counter ("id", "lastNumber", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP)`,
      BILL_COUNTER_ID,
      maxStoredBillNumber
    );
    return;
  }

  const counterLastNumber = Number(existingCounter[0]?.lastNumber ?? 0);
  const reconciledLastNumber = Math.max(counterLastNumber, maxStoredBillNumber);

  if (reconciledLastNumber === counterLastNumber) return;

  await prisma.$executeRawUnsafe(
    `UPDATE bill_number_counter
     SET "lastNumber" = ?, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = ?`,
    reconciledLastNumber,
    BILL_COUNTER_ID
  );
};

const COLUMN_ADDITIONS = {
  LaborProfile: [
    { name: "phone", definition: `"phone" TEXT` },
    { name: "city", definition: `"city" TEXT` },
    { name: "defaultRate", definition: `"defaultRate" DECIMAL` },
  ],
};

const ensureColumnAdditions = async (prisma) => {
  for (const [tableName, columns] of Object.entries(COLUMN_ADDITIONS)) {
    const existing = await prisma.$queryRawUnsafe(
      `PRAGMA table_info("${tableName}")`,
    );

    for (const column of columns) {
      if (existing.some((row) => row.name === column.name)) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tableName}" ADD COLUMN ${column.definition}`,
      );
    }
  }
};

// Older databases have an obsolete `LaborProfile.paymentTypeId` column with a
// NOT NULL foreign key that the current schema dropped. It blocks every write
// (create profile, sync upsert). SQLite cannot DROP a column involved in a
// foreign key, so rebuild the table to match the current schema. Idempotent:
// runs only when the legacy column is present.
const ensureLaborProfileSchema = async (prisma) => {
  const columns = await prisma.$queryRawUnsafe(
    `PRAGMA table_info("LaborProfile")`,
  );

  if (!columns.some((column) => column.name === "paymentTypeId")) {
    return;
  }

  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF`);
  try {
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`
        CREATE TABLE "LaborProfile_new" (
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
        )
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO "LaborProfile_new"
          ("id", "name", "department", "phone", "city", "defaultRate",
           "status", "deletedAt", "createdAt", "updatedAt")
        SELECT
          "id", "name", "department", "phone", "city", "defaultRate",
          "status", "deletedAt", "createdAt", "updatedAt"
        FROM "LaborProfile"
      `),
      prisma.$executeRawUnsafe(`DROP TABLE "LaborProfile"`),
      prisma.$executeRawUnsafe(
        `ALTER TABLE "LaborProfile_new" RENAME TO "LaborProfile"`,
      ),
      prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "LaborProfile_department_idx" ON "LaborProfile"("department")`,
      ),
    ]);
  } finally {
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON`);
  }
};

const ensureSoftDeleteSchema = async (prisma) => {
  for (const tableName of SOFT_DELETE_TABLES) {
    const columns = await prisma.$queryRawUnsafe(
      `PRAGMA table_info("${tableName}")`,
    );

    if (columns.some((column) => column.name === "deletedAt")) {
      continue;
    }

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tableName}" ADD COLUMN "deletedAt" DATETIME`,
    );
  }
};

export const initPrisma = async () => {
  ensurePackagedDatabase();
  await ensureBillSchema(basePrisma);
  await ensureColumnAdditions(basePrisma);
  await ensureLaborProfileSchema(basePrisma);
  await ensureSoftDeleteSchema(basePrisma);
  await ensureSyncTables(basePrisma);
};

const prisma = withChangeLogging(basePrisma, getDeviceId);

export default prisma;
