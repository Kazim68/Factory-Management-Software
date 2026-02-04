import path from "path";
import { app } from "electron";
import { PrismaClient } from "@prisma/client";

const resolveDatabaseUrl = () => {
  if (app?.getPath) {
    const dbPath = path.join(app.getPath("userData"), "factory.db");
    return `file:${dbPath}`;
  }

  const dbPath = path.join(process.cwd(), "factory.db");
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
