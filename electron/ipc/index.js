import { registerIpcHandlers } from "./handlers.js";
import { registerUpdaterIpc } from "./updater.js";

const registerIpc = (ipcMain) => {
  registerIpcHandlers(ipcMain);
  registerUpdaterIpc(ipcMain);
};

export default registerIpc;
