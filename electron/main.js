import { app, BrowserWindow , ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startServer } from "./server/app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


ipcMain.handle("get-todos", async () => {
  const res = await fetch("http://localhost:3001/todos");
  return res.json();
});

ipcMain.handle("add-todo", async (_, text) => {
  await fetch("http://localhost:3001/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
});


function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  startServer();     // 🔴 REQUIRED
  createWindow();
});
