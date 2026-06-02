import crypto from "crypto";
import os from "os";
import { patchLicenseFile, readLicenseFile } from "./licenseStore.js";

// Device identity rules (Approch.docx P199–P207):
//  - Generated on first launch and persisted in `license.json`.
//  - NEVER regenerated after first activation.
//  - NOT derived from hardware identifiers (MAC, motherboard ID, etc.) so the
//    binding survives Windows reinstalls and hardware swaps.
//  - The customer can move the install to a new PC by copying license.json.

let cachedDeviceId = null;
let cachedDeviceName = null;

export const getDeviceId = () => {
  if (cachedDeviceId) return cachedDeviceId;

  const existing = readLicenseFile();
  if (existing?.deviceId && typeof existing.deviceId === "string") {
    cachedDeviceId = existing.deviceId;
    return cachedDeviceId;
  }

  const newId = crypto.randomUUID();
  patchLicenseFile({ deviceId: newId });
  cachedDeviceId = newId;
  return cachedDeviceId;
};

export const getDeviceName = () => {
  if (cachedDeviceName) return cachedDeviceName;

  const existing = readLicenseFile();
  if (existing?.deviceName) {
    cachedDeviceName = existing.deviceName;
    return cachedDeviceName;
  }

  let name = "CrossX device";
  try {
    name = `${os.hostname()} (${os.userInfo().username})`;
  } catch {
    /* fall back to default */
  }

  patchLicenseFile({ deviceName: name });
  cachedDeviceName = name;
  return cachedDeviceName;
};
