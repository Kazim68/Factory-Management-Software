const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getTodos: () => ipcRenderer.invoke("get-todos"),
  addTodo: (text) => ipcRenderer.invoke("add-todo", text),
});
