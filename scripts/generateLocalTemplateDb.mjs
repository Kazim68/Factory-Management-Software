import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const prismaDir = path.join(rootDir, "prisma");
const sourceSchemaPath = path.join(prismaDir, "schema.prisma");
const tempSchemaPath = path.join(prismaDir, "schema.template.prisma");
const templateDir = path.join(rootDir, "database", "generated", "local-template");
const templateDbPath = path.join(templateDir, "factory-template.db");
const prismaCliPath = path.join(rootDir, "node_modules", "prisma", "build", "index.js");

const sourceSchema = fs.readFileSync(sourceSchemaPath, "utf8");
const relativeDbPath = path
  .relative(prismaDir, templateDbPath)
  .split(path.sep)
  .join("/");

const tempSchema = sourceSchema.replace(
  /url\s*=\s*"file:\.\/dev\.db"/,
  `url      = "file:${relativeDbPath}"`,
);

if (tempSchema === sourceSchema) {
  throw new Error(
    "Failed to rewrite prisma/schema.prisma datasource for the template database.",
  );
}

fs.mkdirSync(templateDir, { recursive: true });
fs.rmSync(templateDbPath, { force: true });
fs.writeFileSync(tempSchemaPath, tempSchema);

try {
  const result = spawnSync(
    process.execPath,
    [prismaCliPath, "migrate", "deploy", "--schema", tempSchemaPath],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
} finally {
  fs.rmSync(tempSchemaPath, { force: true });
}

if (!fs.existsSync(templateDbPath)) {
  throw new Error("Template database was not created.");
}

console.log(`Created template database at ${templateDbPath}`);
