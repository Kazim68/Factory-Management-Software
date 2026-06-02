import { getLicenseServerUrl, REQUEST_TIMEOUT_MS } from "./config.js";

// Thin wrapper over `fetch` with timeouts and consistent error mapping.
// Returns a plain object: `{ ok: true, data }` or `{ ok: false, status, error }`.
// The orchestrating services translate that into a user-facing status.

const postJson = async (path, body) => {
  const url = `${getLicenseServerUrl().replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CrossX-Electron",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const error =
        (data && typeof data === "object" && data.error) ||
        (typeof data === "string" ? data : null) ||
        `HTTP ${response.status}`;
      return { ok: false, status: response.status, error };
    }
    return { ok: true, data };
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: isAbort
        ? "License server did not respond in time."
        : `Cannot reach license server (${err?.message ?? "network error"}).`,
    };
  } finally {
    clearTimeout(timer);
  }
};

export const licenseClient = {
  activate: ({ licenseKey, deviceId, deviceName }) =>
    postJson("/api/license/activate", { licenseKey, deviceId, deviceName }),
  verify: ({ licenseKey, deviceId }) =>
    postJson("/api/license/verify", { licenseKey, deviceId }),
  heartbeat: ({ licenseKey, deviceId }) =>
    postJson("/api/license/heartbeat", { licenseKey, deviceId }),
};
