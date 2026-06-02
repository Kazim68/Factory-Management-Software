import fs from "fs";
import path from "path";
import { app } from "electron";

// Resolves the license server URL. Order of precedence:
//   1. `LICENSE_SERVER_URL` environment variable.
//   2. `license.config.json` next to the executable / project root (key: `serverUrl`).
//   3. Hard fallback: http://localhost:4100.
const DEFAULT_URL = "http://localhost:4100";

const readConfigFile = () => {
  const candidates = [];

  if (app?.isPackaged) {
    // Side-by-side with the .exe (next to resources/), so customers can edit it.
    try {
      const exeDir = path.dirname(app.getPath("exe"));
      candidates.push(path.join(exeDir, "license.config.json"));
    } catch {
      /* not packaged */
    }
  } else {
    // Project root in dev.
    candidates.push(path.resolve(process.cwd(), "license.config.json"));
  }

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        if (raw && typeof raw.serverUrl === "string" && raw.serverUrl.trim()) {
          return raw.serverUrl.trim();
        }
      }
    } catch (err) {
      console.warn(`[license] failed to read ${file}:`, err.message);
    }
  }

  return null;
};

let cachedUrl = null;

export const getLicenseServerUrl = () => {
  if (cachedUrl) return cachedUrl;

  const fromEnv =
    typeof process.env.LICENSE_SERVER_URL === "string" &&
    process.env.LICENSE_SERVER_URL.trim();
  if (fromEnv) {
    cachedUrl = process.env.LICENSE_SERVER_URL.trim();
    return cachedUrl;
  }

  const fromFile = readConfigFile();
  if (fromFile) {
    cachedUrl = fromFile;
    return cachedUrl;
  }

  cachedUrl = DEFAULT_URL;
  return cachedUrl;
};

export const REQUEST_TIMEOUT_MS = 10_000;
