import { EventEmitter } from "events";
import { getDeviceId, getDeviceName } from "./deviceService.js";
import {
  readLicenseFile,
  patchLicenseFile,
  clearLicenseBinding,
} from "./licenseStore.js";
import { licenseClient } from "./licenseClient.js";

// Orchestrates the license lifecycle and exposes a cached status that the
// sync worker can read synchronously and the renderer can read via IPC.

const VERIFY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (docx P238)
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const emitter = new EventEmitter();

let cachedStatus = {
  valid: false,
  hasKey: false,
  reason: "License not yet checked.",
};

let verifyTimer = null;
let heartbeatTimer = null;

const setStatus = (next) => {
  cachedStatus = { ...next };
  patchLicenseFile({
    lastVerifiedAt: new Date().toISOString(),
    lastStatus: {
      valid: next.valid,
      reason: next.reason,
      companyStatus: next.companyStatus,
      licenseStatus: next.licenseStatus,
    },
  });
  emitter.emit("status", cachedStatus);
};

const buildInvalidStatus = (reason, extras = {}) => ({
  valid: false,
  hasKey: extras.hasKey ?? false,
  reason,
  ...extras,
});

const stateFromFile = () => {
  const file = readLicenseFile();
  return {
    deviceId: file?.deviceId,
    deviceName: file?.deviceName,
    licenseKey: file?.licenseKey,
    companyId: file?.companyId,
    licenseId: file?.licenseId,
    maxDevices: file?.maxDevices,
    expiresAt: file?.expiresAt,
  };
};

// Single, real verify pass against the license server.
const performVerify = async () => {
  const deviceId = getDeviceId();
  const file = stateFromFile();

  if (!file.licenseKey) {
    setStatus(
      buildInvalidStatus("No license key on this device.", {
        hasKey: false,
        deviceId,
      }),
    );
    return cachedStatus;
  }

  const result = await licenseClient.verify({
    licenseKey: file.licenseKey,
    deviceId,
  });

  if (!result.ok) {
    setStatus(
      buildInvalidStatus(result.error, {
        hasKey: true,
        deviceId,
        licenseKey: file.licenseKey,
      }),
    );
    return cachedStatus;
  }

  const payload = result.data || {};
  setStatus({
    valid: !!payload.valid,
    hasKey: true,
    reason: payload.valid ? undefined : payload.reason,
    companyStatus: payload.companyStatus,
    licenseStatus: payload.licenseStatus,
    expiresAt: payload.expiresAt,
    maxDevices: payload.maxDevices,
    deviceId,
  });

  // Persist the most recent server snapshot for offline display.
  patchLicenseFile({
    maxDevices: payload.maxDevices,
    expiresAt: payload.expiresAt,
  });

  return cachedStatus;
};

const performHeartbeat = async () => {
  const file = stateFromFile();
  if (!file.licenseKey) return;
  const deviceId = getDeviceId();
  await licenseClient.heartbeat({ licenseKey: file.licenseKey, deviceId });
};

export const licenseService = {
  // Called once at app startup. Ensures device identity exists, then performs
  // one verify so the cache + sync worker have a fresh status before the
  // renderer mounts.
  async initialize() {
    getDeviceId();
    getDeviceName();
    await performVerify();
    return cachedStatus;
  },

  // Starts the periodic verify + heartbeat timers (docx P237–P244).
  startBackgroundLoop() {
    this.stopBackgroundLoop();
    verifyTimer = setInterval(() => {
      performVerify().catch((err) =>
        console.warn("[license] verify loop error:", err?.message ?? err),
      );
    }, VERIFY_INTERVAL_MS);
    heartbeatTimer = setInterval(() => {
      performHeartbeat().catch((err) =>
        console.warn("[license] heartbeat error:", err?.message ?? err),
      );
    }, HEARTBEAT_INTERVAL_MS);
  },

  stopBackgroundLoop() {
    if (verifyTimer) clearInterval(verifyTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    verifyTimer = null;
    heartbeatTimer = null;
  },

  // Synchronous accessor for the sync worker.
  getCachedStatus() {
    return cachedStatus;
  },

  // Renderer-facing async accessor (resolves immediately from cache).
  async getStatus() {
    return cachedStatus;
  },

  // Manual verify (used by `/license/verify` route and the renderer "Re-check" button).
  verifyNow() {
    return performVerify();
  },

  // Activation flow (docx P222–P235).
  async activate(licenseKey) {
    if (!licenseKey || typeof licenseKey !== "string") {
      throw new Error("License key is required.");
    }
    const key = licenseKey.trim().toUpperCase();
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    const result = await licenseClient.activate({
      licenseKey: key,
      deviceId,
      deviceName,
    });

    if (!result.ok) {
      // Surface the server's error message to the renderer.
      const err = new Error(result.error || "Activation failed.");
      err.status = result.status;
      throw err;
    }

    patchLicenseFile({
      licenseKey: key,
      companyId: result.data.companyId,
      licenseId: result.data.licenseId,
      maxDevices: result.data.maxDevices,
      expiresAt: result.data.expiresAt,
    });

    // Refresh status immediately and notify listeners.
    await performVerify();
    return cachedStatus;
  },

  // Local-only "forget my license"; useful before re-binding to a new key.
  deactivate() {
    clearLicenseBinding();
    cachedStatus = {
      valid: false,
      hasKey: false,
      reason: "License removed locally.",
    };
    emitter.emit("status", cachedStatus);
    return cachedStatus;
  },

  on(event, listener) {
    emitter.on(event, listener);
    return () => emitter.off(event, listener);
  },
};
