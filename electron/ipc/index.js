import { registerIpcHandlers } from "./handlers.js";

const registerIpc = (ipcMain) => {
  registerIpcHandlers(ipcMain);
};

export default registerIpc;
