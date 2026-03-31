import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { PrismaClient } from "@prisma/client";
import { withChangeLogging } from "./sync/changeLogger.js";
import { ensureSyncTables, getDeviceId } from "./sync/syncService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveDatabaseUrl = () => {
  if (app?.isPackaged) {
    const dbPath = path.join(app.getPath("userData"), "factory.db");
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
    `SELECT "id" FROM bill_number_counter WHERE "id" = ? LIMIT 1`,
    BILL_COUNTER_ID
  );

  if (existingCounter.length > 0) return;

  const [row] = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(MAX(CAST("billNumber" AS INTEGER)), 0) AS lastNumber
    FROM "Bill"
    WHERE "billNumber" GLOB '[0-9][0-9][0-9][0-9]'
      AND CAST("billNumber" AS INTEGER) BETWEEN 0 AND 9999
  `);

  const lastNumber = Number(row?.lastNumber ?? 0);
  await prisma.$executeRawUnsafe(
    `INSERT INTO bill_number_counter ("id", "lastNumber", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP)`,
    BILL_COUNTER_ID,
    lastNumber
  );
};

export const initPrisma = async () => {
  await ensureBillSchema(basePrisma);
  await ensureSyncTables(basePrisma);
};

const prisma = withChangeLogging(basePrisma, getDeviceId);

export default prisma;
