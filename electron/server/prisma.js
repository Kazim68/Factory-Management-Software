import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { PrismaClient } from "@prisma/client";

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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
});

export default prisma;
