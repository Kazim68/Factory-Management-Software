import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startServer } from "./server/app.js";
import registerIpc from "./ipc/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (!app.isPackaged) {
    const loadDev = async () => {
      try {
        await win.loadURL("http://localhost:5173");
      } catch (err) {
        // Retry until Vite is ready
        setTimeout(loadDev, 300);
      }
    };
    loadDev();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  startServer();
  registerIpc(ipcMain);
  createWindow();
});
