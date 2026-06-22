import {
  checkForUpdatesNow,
  quitAndInstall,
  getUpdaterInfo,
} from "../services/updater.js";

// Registered by electron/ipc/index.js so it lives alongside the other IPC
// handlers and gets initialized in the same `app.whenReady()` block.
export const registerUpdaterIpc = (ipcMain) => {
  ipcMain.handle("updater:check", async () => {
    return await checkForUpdatesNow();
  });

  ipcMain.handle("updater:install", () => {
    return quitAndInstall();
  });

  ipcMain.handle("updater:info", () => {
    return getUpdaterInfo();
  });
};
