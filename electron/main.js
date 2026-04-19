import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startServer } from "./server/app.js";
import { initPrisma } from "./server/prisma.js";
import { startSyncWorker } from "./syncWorker.js";
import { disconnectCloudPrisma } from "./server/cloudPrisma.js";
import registerIpc from "./ipc/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let syncWorker;

const formatError = (error) => error?.stack ?? String(error);

const reportStartupError = (title, error) => {
  const details = formatError(error);
  console.error(`${title}:`, details);

  try {
    dialog.showErrorBox(title, details);
  } catch {
    // If Electron cannot show a dialog yet, keep the console error.
  }
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      reportStartupError(
        "CrossX failed to load the UI",
        new Error(
          `Renderer load failed (${errorCode}): ${errorDescription}\nURL: ${validatedURL}`,
        ),
      );
    },
  );

  if (!app.isPackaged) {
    const loadDev = async () => {
      try {
        await win.loadURL("http://localhost:5173");
      } catch {
        setTimeout(loadDev, 300);
      }
    };
    loadDev();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  await initPrisma();
  await startServer();
  registerIpc(ipcMain);
  syncWorker = startSyncWorker();
  createWindow();
}).catch((error) => {
  reportStartupError("CrossX failed to start", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (syncWorker) syncWorker.stop();
  disconnectCloudPrisma().catch((error) =>
    console.error("Cloud Prisma disconnect error:", error)
  );
  if (process.platform !== "darwin") app.quit();
});
