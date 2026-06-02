import fs from "fs";
import path from "path";
import os from "os";
import { app } from "electron";

// Stores the local license/device state in `userData/license.json`.
//
// Shape:
// {
//   deviceId: string,         // generated once, never overwritten
//   deviceName?: string,
//   licenseKey?: string,
//   companyId?: string,
//   licenseId?: string,
//   maxDevices?: number,
//   expiresAt?: string,
//   lastVerifiedAt?: string,
//   lastStatus?: {
//     valid: boolean,
//     reason?: string,
//     companyStatus?: "ACTIVE" | "BLOCKED" | "EXPIRED",
//     licenseStatus?: "ACTIVE" | "BLOCKED" | "EXPIRED"
//   }
// }

const FILE_NAME = "license.json";

const getStorePath = () => {
  // Falls back to a temp dir if Electron `app` is unavailable (e.g. unit tests).
  try {
    return path.join(app.getPath("userData"), FILE_NAME);
  } catch {
    return path.join(os.tmpdir(), FILE_NAME);
  }
};

export const readLicenseFile = () => {
  const file = getStorePath();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[license] failed to read license.json:", err.message);
    return null;
  }
};

// Atomic write: stream to a temp file then rename, so we never leave the user
// with a half-written license.json after a crash.
export const writeLicenseFile = (data) => {
  const file = getStorePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
};

export const patchLicenseFile = (patch) => {
  const current = readLicenseFile() ?? {};
  const next = { ...current, ...patch };
  writeLicenseFile(next);
  return next;
};

// Clears only the license binding; the deviceId is intentionally preserved
// so re-activation on the same machine reuses the existing Device row.
export const clearLicenseBinding = () => {
  const current = readLicenseFile() ?? {};
  const next = {
    deviceId: current.deviceId,
    deviceName: current.deviceName,
  };
  writeLicenseFile(next);
  return next;
};
