import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import log from "electron-log";

const { autoUpdater } = electronUpdater;

// 6 hours in milliseconds, per Plan.txt periodic-check requirement.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Short initial delay so the window has time to mount and subscribe before
// the first update payload is broadcast.
const STARTUP_CHECK_DELAY_MS = 10 * 1000;

let mainWindowRef = null;
let periodicTimer = null;
let initialized = false;

const sendToRenderer = (channel, payload) => {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  try {
    mainWindowRef.webContents.send(channel, payload);
  } catch (error) {
    log.warn(`[updater] failed to forward ${channel} to renderer:`, error);
  }
};

const configureLogger = () => {
  // electron-log routes to userData/logs/main.log by default. autoUpdater
  // expects a logger that implements .info/.warn/.error.
  log.transports.file.level = "info";
  log.transports.console.level = "info";
  autoUpdater.logger = log;
};

const configureUpdater = () => {
  // Download manually controlled in dev (disabled) but auto in production
  // so the user gets the VS Code / Discord style background download.
  autoUpdater.autoDownload = true;
  // We trigger the install ourselves on user confirmation.
  autoUpdater.autoInstallOnAppQuit = true;
  // Allow downgrade only if the user explicitly publishes a lower version.
  autoUpdater.allowDowngrade = false;
  // The Windows installer is not code-signed (no certificate), so skip the
  // publisher signature check. electron-updater treats a null return as
  // "signature is valid". Remove this once a real code-signing cert is used.
  autoUpdater.verifyUpdateCodeSignature = () => Promise.resolve(null);
};

const registerEvents = () => {
  autoUpdater.on("checking-for-update", () => {
    log.info("[updater] checking-for-update");
    sendToRenderer("updater:checking");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("[updater] update-available", info?.version);
    sendToRenderer("updater:available", {
      version: info?.version ?? null,
      releaseDate: info?.releaseDate ?? null,
      releaseName: info?.releaseName ?? null,
      releaseNotes: info?.releaseNotes ?? null,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("[updater] update-not-available", info?.version);
    sendToRenderer("updater:not-available", {
      version: info?.version ?? null,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    // Throttling is unnecessary; electron-updater fires this only on chunks.
    sendToRenderer("updater:progress", {
      percent: progress?.percent ?? 0,
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("[updater] update-downloaded", info?.version);
    sendToRenderer("updater:downloaded", {
      version: info?.version ?? null,
      releaseDate: info?.releaseDate ?? null,
      releaseName: info?.releaseName ?? null,
      releaseNotes: info?.releaseNotes ?? null,
    });
  });

  autoUpdater.on("error", (error) => {
    log.error("[updater] error:", error);
    sendToRenderer("updater:error", {
      message: error?.message ?? String(error) ?? "Unknown updater error",
    });
  });
};

const safeCheck = async (reason) => {
  if (!app.isPackaged) {
    log.info(`[updater] skipping check (${reason}) - app is not packaged`);
    return { skipped: true, reason: "dev-mode" };
  }
  try {
    log.info(`[updater] running check (${reason})`);
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, result };
  } catch (error) {
    log.error(`[updater] check failed (${reason}):`, error);
    sendToRenderer("updater:error", {
      message:
        error?.message ?? "Unable to reach the update server. Will retry later.",
    });
    return { ok: false, error: error?.message ?? String(error) };
  }
};

const startPeriodicChecks = () => {
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    safeCheck("periodic");
  }, CHECK_INTERVAL_MS);
  // Allow process exit even if the timer is still scheduled.
  if (typeof periodicTimer.unref === "function") periodicTimer.unref();
};

const stopPeriodicChecks = () => {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
};

export const initUpdater = (mainWindow) => {
  mainWindowRef = mainWindow ?? null;

  if (initialized) {
    log.info("[updater] re-binding renderer target (already initialized)");
    return;
  }
  initialized = true;

  configureLogger();
  configureUpdater();
  registerEvents();

  log.info(
    `[updater] initialized. version=${app.getVersion()} packaged=${app.isPackaged}`,
  );

  if (!app.isPackaged) {
    log.info("[updater] dev mode - skipping startup + periodic checks");
    return;
  }

  // Kick off the first check shortly after launch so the UI is ready.
  setTimeout(() => safeCheck("startup"), STARTUP_CHECK_DELAY_MS);
  startPeriodicChecks();
};

export const checkForUpdatesNow = () => safeCheck("manual");

export const quitAndInstall = () => {
  if (!app.isPackaged) {
    log.info("[updater] quitAndInstall ignored - app is not packaged");
    return { ok: false, error: "dev-mode" };
  }
  try {
    log.info("[updater] quitAndInstall invoked");
    // isSilent=false so NSIS shows progress, isForceRunAfter=true to relaunch.
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (error) {
    log.error("[updater] quitAndInstall failed:", error);
    try {
      dialog.showErrorBox(
        "Update failed to install",
        error?.message ?? String(error),
      );
    } catch {
      // ignore
    }
    return { ok: false, error: error?.message ?? String(error) };
  }
};

export const shutdownUpdater = () => {
  stopPeriodicChecks();
};

export const getUpdaterInfo = () => ({
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  feedURL: (() => {
    try {
      return autoUpdater.getFeedURL();
    } catch {
      return null;
    }
  })(),
});
