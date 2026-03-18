import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../database/generated/cloud-client");

let cloudPrisma;

export const getCloudPrisma = () => {
  if (!cloudPrisma) {
    cloudPrisma = new PrismaClient({
      log: [{ level: "error", emit: "stdout" }],
    });
  }

  return cloudPrisma;
};

export const disconnectCloudPrisma = async () => {
  if (!cloudPrisma) return;
  await cloudPrisma.$disconnect();
  cloudPrisma = null;
};
