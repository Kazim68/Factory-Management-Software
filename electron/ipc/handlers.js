const API_BASE_URL = "http://127.0.0.1:4001";

const requestApi = async (payload) => {
  const { path, method = "GET", body } = payload ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "API request failed");
  }

  return response.json();
};

export const registerIpcHandlers = (ipcMain) => {
  ipcMain.handle("api:request", async (event, payload) =>
    requestApi(payload)
  );
};
