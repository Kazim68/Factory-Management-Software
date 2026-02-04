const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  request: (payload) => ipcRenderer.invoke("api:request", payload),
});
