const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  request: (payload) => ipcRenderer.invoke("api:request", payload),
});

// --- Auto-update bridge ----------------------------------------------------
// Each subscribe helper returns an `unsubscribe` function so React components
// can clean up in their useEffect teardown. We deliberately strip the raw
// IpcRendererEvent before handing payloads to the renderer.

const onChannel = (channel) => (handler) => {
  if (typeof handler !== "function") return () => {};
  const listener = (_event, payload) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`updater handler for ${channel} threw:`, error);
    }
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  getInfo: () => ipcRenderer.invoke("updater:info"),

  onChecking: onChannel("updater:checking"),
  onAvailable: onChannel("updater:available"),
  onNotAvailable: onChannel("updater:not-available"),
  onProgress: onChannel("updater:progress"),
  onDownloaded: onChannel("updater:downloaded"),
  onError: onChannel("updater:error"),
});
