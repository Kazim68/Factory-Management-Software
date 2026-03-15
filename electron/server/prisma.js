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

export const initPrisma = async () => {
  await ensureSyncTables(basePrisma);
};

const prisma = withChangeLogging(basePrisma, getDeviceId);

export default prisma;
