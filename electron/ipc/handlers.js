const API_BASE_URL = "http://127.0.0.1:4001";

const requestApi = async (payload) => {
  const { path, method = "GET", body } = payload ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const rawBody = await response.text();

    if (!rawBody) {
      throw new Error("API request failed");
    }

    let message = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      message = parsed?.error || rawBody;
    } catch {
      message = rawBody;
    }

    throw new Error(message);
  }

  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

export const registerIpcHandlers = (ipcMain) => {
  ipcMain.handle("api:request", async (event, payload) =>
    requestApi(payload)
  );
};
